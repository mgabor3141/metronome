/**
 * WebSocket endpoint for metronome synchronization using astro-bun-websocket
 */
import type { APIRoute } from "astro"
import type { MetronomeState } from "../../components/Metronome.svelte"

// Define types for WebSocket messages
type ClientRegistrationMessage = {
	type: "register"
	clientId: string
}

type StateUpdateMessage = {
	type: "stateUpdate"
	clientId: string
	state: MetronomeState
	isPlaying: boolean
}

type ServerRegistrationConfirmation = {
	type: "registered"
	clientId: string
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
		let clientId = ""

		// Handle WebSocket messages
		socket.onmessage = async (event: MessageEvent<Blob>) => {
			const data = JSON.parse(await event.data.text()) as WebSocketMessage
			try {
				// Handle client registration
				if (data.type === "register") {
					clientId = data.clientId
					console.log(`Client registered: ${clientId}`)

					// Store client connection
					connectedClients.set(clientId, socket)

					// Confirm registration
					socket.send(
						JSON.stringify({
							type: "registered",
							clientId,
							timestamp: new Date().toISOString(),
						} as ServerRegistrationConfirmation),
					)
				}

				// Handle state updates
				if (data.type === "stateUpdate") {
					console.log(
						`State update from ${data.clientId}:`,
						data.state,
					)

					// Broadcast the state update to all other clients
					broadcastMessage(data, data.clientId)
				}

				// Log all received messages
				console.log(`Received message from ${clientId}:`, data)
			} catch (error) {
				console.error("Error processing WebSocket message:", error)
			}
		}

		// Handle WebSocket close
		socket.onclose = () => {
			if (clientId) {
				console.log(`Client disconnected: ${clientId}`)
				connectedClients.delete(clientId)
			}
		}

		// Handle WebSocket errors
		socket.onerror = (error) => {
			console.error(`WebSocket error for client ${clientId}:`, error)
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
	message: WebSocketMessage,
	excludeClientId: string,
): void {
	const messageString = JSON.stringify(message)

	for (const [clientId, socket] of connectedClients.entries()) {
		// Don't send the message back to the sender
		if (clientId !== excludeClientId) {
			try {
				socket.send(messageString)
			} catch (error) {
				console.error(`Error sending message to client ${clientId}:`, error)
			}
		}
	}
}
