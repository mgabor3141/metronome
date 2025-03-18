/**
 * WebSocket endpoint for metronome synchronization using astro-bun-websocket
 */
import type { APIContext } from "astro"
import type { MetronomeState as MetronomeStateType } from "../../metronome/Metronome.svelte"

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
}

// Client connections map: clientId -> WebSocket
const clients = new Map<string, WebSocket>()

// Group membership map: clientCode -> Set of clientIds
const groups = new Map<string, Set<string>>()

// Group state map: clientCode -> MetronomeStateType
const groupStates = new Map<string, MetronomeStateType>()

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

		const socket = clients.get(clientId)
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(messageStr)
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
	})
}

/**
 * Updates the state for a group and broadcasts it
 */
const updateGroupState = (
	clientCode: string,
	clientId: string,
	state: MetronomeStateType,
): void => {
	// Update the group state
	groupStates.set(clientCode, state)

	// Broadcast the state update to all other clients in the group
	broadcastMessageToGroup(
		clientCode,
		{
			type: "stateUpdate",
			clientId,
			clientCode,
			state,
		},
		clientId, // Exclude the sender
	)
}

export const GET = (ctx: APIContext) => {
	// Upgrade the connection to WebSocket
	const { response, socket } = ctx.locals.upgradeWebSocket()

	// Client identification
	let clientId: string | null = null
	let clientCode: string | null = null

	// Handle WebSocket messages
	socket.onmessage = async (event: MessageEvent<Blob>) => {
		try {
			const message = JSON.parse(await event.data.text())
			console.log("Received message:", message)

			// Extract client ID and code from message
			clientId = message.clientId || clientId
			clientCode = message.clientCode || clientCode

			// Handle client registration
			if (message.type === "register" && clientId && clientCode) {
				// Store the client connection
				clients.set(clientId, socket)

				// Add the client to its group
				addClientToGroup(clientId, clientCode)

				// Send registration confirmation
				socket.send(
					JSON.stringify({
						type: "registered",
						clientId,
						clientCode,
						clientsInGroup: getGroupSize(clientCode),
						timestamp: new Date().toISOString(),
					}),
				)

				// Broadcast group size update to all clients in the group
				broadcastGroupSizeUpdate(clientCode)

				// If this group has an existing state, send it to the new client
				const groupState = groupStates.get(clientCode)
				if (groupState) {
					socket.send(
						JSON.stringify({
							type: "initialState",
							state: groupState,
						}),
					)
				}
			}

			// Handle state updates
			if (message.type === "stateUpdate" && clientId && clientCode) {
				// Update the group state and broadcast to other clients
				updateGroupState(clientCode, clientId, message.state)
			}
		} catch (error) {
			console.error("Error processing message:", error)
		}
	}

	// Handle WebSocket close
	socket.onclose = () => {
		console.log(`Client disconnected from ${clientCode}: ${clientId}`)
		if (clientId) removeClientFromGroup(clientId)
	}

	// Handle WebSocket errors
	socket.onerror = (error) => {
		console.error(`WebSocket error for client ${clientId} in ${clientCode}:`, error)
		if (clientId) removeClientFromGroup(clientId)
	}

	return response
}
