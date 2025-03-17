import {
	getGroupCode,
	saveGroupCode,
	clearGroupCode,
} from "../utils/code-utils"
import { onDestroy } from "svelte"
import type { GroupState } from "./Networking.svelte"
import type { GroupStateUpdate } from "../pages/api/group"

// State
let websocket: WebSocket | null = null

/**
 * Joins or creates a group and establishes a WebSocket connection
 * @param peer The PeerJS instance
 * @returns The group code
 */
export const joinGroup = async (
	peerId: string,
	groupStateUpdater: (dispatch: (state: GroupState) => GroupState) => void,
) => {
	// Close any existing connection
	if (websocket && websocket.readyState === WebSocket.OPEN) {
		websocket.close()
	}

	// Check if we have a stored group code
	const storedGroupCode = getGroupCode()

	// Determine if we're on localhost or production
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const host = window.location.host

	// Build the WebSocket URL
	const wsUrl = `${protocol}//${host}/api/group`

	// Create a promise that will resolve when we get our group code
	return new Promise<void>((resolve, reject) => {
		try {
			// Create WebSocket connection
			groupStateUpdater((state) => ({
				...state,
				connectionStatus: "connecting",
			}))
			websocket = new WebSocket(wsUrl)

			// Handle connection open
			websocket.onopen = () => {
				console.log("WebSocket connection established")
				websocket?.send(
					JSON.stringify({
						type: "register",
						peerId,
						groupCode: storedGroupCode,
					}),
				)

				groupStateUpdater((state) => ({
					...state,
					connectionStatus: "connected",
				}))

				resolve()
			}

			// Handle incoming messages
			websocket.onmessage = (event) => {
				const message: GroupStateUpdate = JSON.parse(event.data)
				console.log("Received WebSocket message:", message)

				// Handle group updates
				if (message.type === "groupUpdate") {
					saveGroupCode(message.groupCode)
					groupStateUpdater((state) => ({
						...state,
						...message,
						isGroupLeader: message.leader === peerId,
					}))
				}
			}

			// Handle connection close
			websocket.onclose = () => {
				console.log("WebSocket connection closed")
				groupStateUpdater((state) => ({
					...state,
					connectionStatus: "disconnected",
				}))
			}

			// Handle connection errors
			websocket.onerror = (error) => {
				console.error("WebSocket error:", error)
				groupStateUpdater((state) => ({
					...state,
					connectionStatus: "disconnected",
				}))
				reject(new Error("Failed to establish WebSocket connection"))
			}
		} catch (error) {
			console.error("Error creating WebSocket:", error)
			groupStateUpdater((state) => ({
				...state,
				connectionStatus: "disconnected",
			}))
			reject(error)
		}
	})
}

/**
 * Leaves the current group
 */
// const leaveGroup = (): void => {
// 	// Close the WebSocket connection
// 	if (websocket) {
// 		websocket.close()
// 		websocket = null
// 	}

// 	// Clear the group state
// 	groupStateUpdater((state) => ({
// 		...state,
// 		code: "",
// 		members: [],
// 		leader: null,
// 		memberCount: 0,
// 		isGroupLeader: false,
// 		connectionStatus: "disconnected",
// 	})

// 	// Clear the stored group code
// 	clearGroupCode()
// }
