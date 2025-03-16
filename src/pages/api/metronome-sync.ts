/**
 * WebSocket endpoint for metronome synchronization using astro-bun-websocket
 */
import type { APIContext } from "astro"
import type { MetronomeState as MetronomeStateType } from "../../components/Metronome.svelte"

// Define message types
interface BaseMessage {
	type: string
	clientId: string
	clientCode: string
}

interface RegisterMessage extends BaseMessage {
	type: "register"
}

interface StateUpdateMessage extends BaseMessage {
	type: "stateUpdate"
	state: MetronomeStateType
	isPlaying: boolean
}

// Client connections map: clientId -> WebSocket
const clients = new Map<string, WebSocket>()

// Group membership map: clientCode -> Set of clientIds
const groups = new Map<string, Set<string>>()

// Group state map: clientCode -> { state, isPlaying }
const groupStates = new Map<
	string,
	{ state: MetronomeStateType; isPlaying: boolean }
>()

/**
 * Adds a client to a group
 */
const addClientToGroup = (clientId: string, clientCode: string): void => {
	// Get or create the group
	if (!groups.has(clientCode)) {
		groups.set(clientCode, new Set())
	}

	// Add the client to the group
	const group = groups.get(clientCode)
	if (group) {
		group.add(clientId)
		console.log(
			`Added client ${clientId} to group ${clientCode}. Group size: ${group.size}`,
		)
	}
}

/**
 * Removes a client from its group
 */
const removeClientFromGroup = (clientId: string): void => {
	// Find the group that contains this client
	for (const [clientCode, clientIds] of groups.entries()) {
		if (clientIds.has(clientId)) {
			clientIds.delete(clientId)
			console.log(
				`Removed client ${clientId} from group ${clientCode}. Group size: ${clientIds.size}`,
			)

			// If the group is now empty, remove it and its state
			if (clientIds.size === 0) {
				groups.delete(clientCode)
				groupStates.delete(clientCode)
				console.log(`Group ${clientCode} is now empty and has been removed`)
			} else {
				// Notify remaining clients about the departure
				broadcastGroupSizeUpdate(clientCode)
			}

			break
		}
	}
}

/**
 * Gets the number of clients in a group
 */
const getGroupSize = (clientCode: string): number => {
	const group = groups.get(clientCode)
	return group ? group.size : 0
}

/**
 * Broadcasts a message to all clients in a group
 */
const broadcastMessageToGroup = (
	clientCode: string,
	message: Record<string, unknown>,
	excludeClientId?: string,
): void => {
	const group = groups.get(clientCode)
	if (!group) return

	const messageStr = JSON.stringify(message)

	for (const clientId of group) {
		// Skip the excluded client if specified
		if (excludeClientId && clientId === excludeClientId) continue

		const client = clients.get(clientId)
		if (client && client.readyState === WebSocket.OPEN) {
			client.send(messageStr)
		}
	}
}

/**
 * Broadcasts a group size update to all clients in a group
 */
const broadcastGroupSizeUpdate = (clientCode: string): void => {
	const groupSize = getGroupSize(clientCode)

	broadcastMessageToGroup(clientCode, {
		type: "groupUpdate",
		clientCode,
		clientsInGroup: groupSize,
		timestamp: new Date().toISOString(),
	})
}

/**
 * Updates the state for a group and broadcasts it
 */
const updateGroupState = (
	clientCode: string,
	clientId: string,
	state: MetronomeStateType,
	isPlaying: boolean,
): void => {
	// Store the state for this group
	groupStates.set(clientCode, { state, isPlaying })

	// Broadcast the state update to other clients in the group
	broadcastMessageToGroup(
		clientCode,
		{
			type: "stateUpdate",
			clientId,
			clientCode,
			state,
			isPlaying,
			timestamp: new Date().toISOString(),
		},
		clientId,
	)
}

export async function GET(ctx: APIContext) {
	// Upgrade the connection to WebSocket
	const { response, socket } = ctx.locals.upgradeWebSocket()

	// Generate a unique ID for this connection
	let clientId = ""
	let clientCode = ""

	// Handle connection close
	socket.addEventListener("close", () => {
		console.log(`WebSocket connection closed for client ${clientId}`)

		// Remove the client
		clients.delete(clientId)

		// Remove the client from its group
		if (clientId) {
			removeClientFromGroup(clientId)
		}
	})

	socket.onmessage = async (event: MessageEvent<Blob>) => {
		try {
			const message = JSON.parse(await event.data.text())

			// Handle registration
			if (message.type === "register") {
				clientId = message.clientId
				clientCode = message.clientCode

				// Store the client connection
				clients.set(clientId, socket)

				// Add the client to its group
				addClientToGroup(clientId, clientCode)

				// Send registration confirmation
				const groupSize = getGroupSize(clientCode)
				socket.send(
					JSON.stringify({
						type: "registered",
						clientId,
						clientCode,
						clientsInGroup: groupSize,
						timestamp: new Date().toISOString(),
					}),
				)

				// If this group already has a state, send it to the new client
				const groupState = groupStates.get(clientCode)
				if (groupState) {
					socket.send(
						JSON.stringify({
							type: "initialState",
							state: groupState.state,
							isPlaying: groupState.isPlaying,
							timestamp: new Date().toISOString(),
						}),
					)
				}

				// Notify other clients in the group about the new client
				broadcastGroupSizeUpdate(clientCode)

				console.log(`Client ${clientId} registered in group ${clientCode}`)
			}

			// Handle state updates
			if (message.type === "stateUpdate") {
				// Update the group state and broadcast to other clients
				updateGroupState(
					message.clientCode,
					message.clientId,
					message.state,
					message.isPlaying,
				)
			}

			// Handle ping messages
			if (message.type === "ping") {
				socket.send(
					JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }),
				)
			}
		} catch (error) {
			console.error("Error processing WebSocket message:", error)
		}
	}

	// Handle WebSocket close
	socket.onclose = () => {
		if (clientCode) {
			console.log(`Client disconnected: ${clientCode}`)
			removeClientFromGroup(clientCode)
		}
	}

	// Handle WebSocket errors
	socket.onerror = (error) => {
		console.error(`WebSocket error for client ${clientCode}:`, error)
		removeClientFromGroup(clientCode)
	}

	return response
}
