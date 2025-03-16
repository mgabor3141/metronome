/**
 * WebSocket endpoint for metronome synchronization using astro-bun-websocket
 */
import type { APIRoute } from "astro"
import type { MetronomeState } from "../../components/Metronome.svelte"

// Define types for WebSocket messages
type ClientRegistrationMessage = {
	type: "register"
	clientCode: string
}

type StateUpdateMessage = {
	type: "stateUpdate"
	clientCode: string
	state: MetronomeState
	isPlaying: boolean
}

type ServerRegistrationConfirmation = {
	type: "registered"
	clientCode: string
	timestamp: string
}

type WebSocketMessage = ClientRegistrationMessage | StateUpdateMessage

// Store active connections (would be lost on server restart)
const connectedClients = new Map<string, WebSocket>()

/**
 * WebSocket endpoint handler
 */
export const GET: APIRoute = async (context) => {
	// Check if the request is a WebSocket upgrade request
	if (context.locals.isUpgradeRequest) {
		// Upgrade the connection to WebSocket
		const { response, socket } = context.locals.upgradeWebSocket()
		let clientCode = ""

		// Handle WebSocket messages
		socket.onmessage = async (event: MessageEvent<Blob>) => {
			try {
				const data = JSON.parse(await event.data.text())
				
				// Handle client registration
				if (data.type === "register" && data.clientCode) {
					clientCode = data.clientCode
					console.log(`Client registered: ${clientCode}`)

					// Store client connection
					connectedClients.set(clientCode, socket)

					// Confirm registration
					socket.send(
						JSON.stringify({
							type: "registered",
							clientCode,
							timestamp: new Date().toISOString(),
						} as ServerRegistrationConfirmation),
					)
				}

				// Handle state updates
				if (data.type === "stateUpdate" && data.clientCode) {
					console.log(
						`State update from ${data.clientCode}:`,
						data.state,
					)

					// Broadcast the state update to all other clients
					broadcastMessage(data, data.clientCode)
				}
			} catch (error) {
				console.error("Error processing WebSocket message:", error)
			}
		}

		// Handle WebSocket close
		socket.onclose = () => {
			if (clientCode) {
				console.log(`Client disconnected: ${clientCode}`)
				connectedClients.delete(clientCode)
			}
		}

		// Handle WebSocket errors
		socket.onerror = (error) => {
			console.error(`WebSocket error for client ${clientCode}:`, error)
		}

		return response
	}

	// Return a normal response for non-WebSocket requests
	return new Response("This endpoint requires a WebSocket connection", {
		status: 400,
	})
}

/**
 * Broadcast a message to all connected clients except the sender
 */
function broadcastMessage(
	message: StateUpdateMessage,
	excludeClientCode: string,
): void {
	const messageString = JSON.stringify(message)

	for (const [clientCode, socket] of connectedClients.entries()) {
		// Don't send the message back to the sender
		if (clientCode !== excludeClientCode) {
			try {
				socket.send(messageString)
			} catch (error) {
				console.error(`Error sending message to client ${clientCode}:`, error)
			}
		}
	}
}
