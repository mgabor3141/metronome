<script lang="ts">
/**
 * MetronomeNetwork component that handles WebSocket connections
 * for synchronizing metronome state across devices
 */
import { onMount, onDestroy } from "svelte"
import type { MetronomeState } from "./Metronome.svelte"

interface MetronomeNetworkProps {
	state: MetronomeState
	isPlaying: boolean
	onRemoteStateUpdate?: (state: MetronomeState, isPlaying: boolean) => void
}

const props: MetronomeNetworkProps = $props()

// Network state
type NetworkState = {
	clientId: string
	isConnected: boolean
	lastSyncTime: string | null
	connectionAttempts: number
	isSyncing: boolean
}

const networkState = $state<NetworkState>({
	clientId: crypto.randomUUID(),
	isConnected: false,
	lastSyncTime: null,
	connectionAttempts: 0,
	isSyncing: false,
})

// WebSocket connection
let socket: WebSocket | null = null
// Debounce timer for state updates
let stateUpdateDebounce: number | null = null

/**
 * Establishes WebSocket connection to the server
 */
const connectToServer = (): void => {
	// Close existing connection if any
	if (socket) {
		socket.close()
	}

	// Determine WebSocket URL based on current location
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const wsUrl = `${protocol}//${window.location.host}/api/metronome-sync`

	console.log(`Connecting to WebSocket server at ${wsUrl}`)

	try {
		socket = new WebSocket(wsUrl)

		socket.addEventListener("open", () => {
			console.log("WebSocket connection established")
			networkState.isConnected = true
			networkState.connectionAttempts = 0

			// Register this client with the server
			sendMessage({
				type: "register",
				clientId: networkState.clientId,
			})
		})

		socket.addEventListener("message", (event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data as string)
				console.log("Received message:", message)

				if (message.type === "registered") {
					networkState.lastSyncTime = message.timestamp
					console.log(
						`Successfully registered with server as client: ${message.clientId}`,
					)

					// Send initial state after registration
					sendStateUpdate(props.state, props.isPlaying)
				}

				// Handle state updates from other clients
				if (
					message.type === "stateUpdate" &&
					message.clientId !== networkState.clientId
				) {
					console.log("Received state update from another client:", message)

					// Temporarily set syncing flag to prevent echo
					networkState.isSyncing = true

					// Update local state if callback is provided
					if (props.onRemoteStateUpdate) {
						props.onRemoteStateUpdate(message.state, message.isPlaying)
					}

					// Reset syncing flag after a short delay
					setTimeout(() => {
						networkState.isSyncing = false
					}, 100)

					// Update last sync time
					networkState.lastSyncTime = new Date().toISOString()
				}
			} catch (error) {
				console.error("Error processing incoming message:", error)
			}
		})

		socket.addEventListener("close", () => {
			console.log("WebSocket connection closed")
			networkState.isConnected = false

			// Attempt to reconnect with exponential backoff
			if (networkState.connectionAttempts < 5) {
				const backoffTime = Math.min(
					1000 * 2 ** networkState.connectionAttempts,
					30000,
				)
				networkState.connectionAttempts++

				console.log(
					`Attempting to reconnect in ${backoffTime}ms (attempt ${networkState.connectionAttempts})`,
				)
				setTimeout(connectToServer, backoffTime)
			} else {
				console.log("Max reconnection attempts reached")
			}
		})

		socket.addEventListener("error", (error: Event) => {
			console.error("WebSocket error:", error)
		})
	} catch (error) {
		console.error("Failed to create WebSocket connection:", error)
	}
}

/**
 * Sends a message to the server
 */
const sendMessage = (data: Record<string, unknown>): void => {
	if (socket && socket.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify(data))
	} else {
		console.warn("Cannot send message: WebSocket not connected")
	}
}

/**
 * Sends the current metronome state to the server
 */
const sendStateUpdate = (state: MetronomeState, isPlaying: boolean): void => {
	if (!networkState.isConnected) return

	sendMessage({
		type: "stateUpdate",
		clientId: networkState.clientId,
		state,
		isPlaying,
	})

	networkState.lastSyncTime = new Date().toISOString()
}

/**
 * Debounced state update to prevent flooding the server
 */
const debouncedStateUpdate = (
	state: MetronomeState,
	isPlaying: boolean,
): void => {
	if (stateUpdateDebounce) {
		clearTimeout(stateUpdateDebounce)
	}

	stateUpdateDebounce = setTimeout(() => {
		sendStateUpdate(state, isPlaying)
		stateUpdateDebounce = null
	}, 100) as unknown as number
}

// Watch for state changes to sync with server
$effect(() => {
	// Skip if not connected or if we're currently syncing from a remote update
	if (!networkState.isConnected || networkState.isSyncing) return

	// Send state updates to the server with debouncing
	debouncedStateUpdate(props.state, props.isPlaying)
})

// Connect to server when component mounts
onMount(() => {
	connectToServer()
})

// Clean up connection when component is destroyed
onDestroy(() => {
	if (socket) {
		socket.close()
		socket = null
	}

	if (stateUpdateDebounce) {
		clearTimeout(stateUpdateDebounce)
	}
})
</script>

<!-- No visible UI for this component -->
