<script lang="ts">
/**
 * MetronomeNetwork component that handles WebSocket connections
 * for synchronizing metronome state across devices
 */
import { onMount, onDestroy } from "svelte"
import type { MetronomeState } from "./Metronome.svelte"
import { getClientCode, hasClientCode, saveClientCode } from "../utils/code-utils"

interface MetronomeNetworkProps {
	state: MetronomeState
	isPlaying: boolean
	onRemoteStateUpdate?: (state: MetronomeState, isPlaying: boolean) => void
}

const props: MetronomeNetworkProps = $props()

// Network state
interface NetworkState {
	clientCode: string
	isConnected: boolean
	lastSyncTime: string | null
	connectionAttempts: number
	isSyncing: boolean
	isRequestingCode: boolean
}

const networkState = $state<NetworkState>({
	clientCode: "",
	isConnected: false,
	lastSyncTime: null,
	connectionAttempts: 0,
	isSyncing: false,
	isRequestingCode: false,
})

// WebSocket connection
let socket: WebSocket | null = null
// Debounce timer for state updates
let stateUpdateDebounce: number | null = null

/**
 * Fetches a new client code from the server
 */
const requestClientCode = async (): Promise<string> => {
	networkState.isRequestingCode = true
	
	try {
		const response = await fetch("/api/client-code")
		const data = await response.json()
		
		if (data.success && data.code) {
			// Save the code to local storage
			saveClientCode(data.code)
			console.log(`Received new client code: ${data.code}`)
			return data.code
		}
		
		throw new Error(data.message || "Failed to get client code")
	} catch (error) {
		console.error("Error requesting client code:", error)
		throw error
	} finally {
		networkState.isRequestingCode = false
	}
}

/**
 * Registers an existing client code with the server
 */
const registerExistingCode = async (code: string): Promise<void> => {
	try {
		const response = await fetch("/api/client-code", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ code }),
		})
		
		const data = await response.json()
		
		if (!data.success) {
			console.error("Failed to register client code:", data.message)
			await requestClientCode()
		} else {
			console.log(`Registered existing client code: ${code}`)
		}
	} catch (error) {
		console.error("Error registering client code:", error)
		await requestClientCode()
	}
}

/**
 * Initializes the client code - either retrieves from local storage or requests a new one
 */
const initializeClientCode = async (): Promise<void> => {
	try {
		if (hasClientCode()) {
			// Use existing code from local storage
			const code = getClientCode()
			if (code) {
				networkState.clientCode = code
				console.log(`Using existing client code: ${code}`)
				await registerExistingCode(code)
			} else {
				throw new Error("Client code is null despite hasClientCode() returning true")
			}
		} else {
			// Request a new code from the server
			const newCode = await requestClientCode()
			networkState.clientCode = newCode
		}
	} catch (error) {
		console.error("Error initializing client code:", error)
		// If all else fails, try to get a new code
		try {
			const newCode = await requestClientCode()
			networkState.clientCode = newCode
		} catch (fallbackError) {
			console.error("Failed to get client code in fallback:", fallbackError)
		}
	}
}

/**
 * Establishes WebSocket connection to the server
 */
const connectToServer = async (): Promise<void> => {
	// Initialize client code before connecting
	await initializeClientCode()
	
	// Ensure we have a client code before proceeding
	if (!networkState.clientCode) {
		console.error("Cannot connect to server without a client code")
		return
	}
	
	// Close existing connection if any
	if (socket) {
		socket.close()
	}

	// Determine WebSocket URL based on current location
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const wsUrl = `${protocol}//${window.location.host}/api/metronome-sync`

	console.log(`Connecting to WebSocket server at ${wsUrl} as ${networkState.clientCode}`)

	try {
		socket = new WebSocket(wsUrl)

		socket.addEventListener("open", () => {
			console.log("WebSocket connection established")
			networkState.isConnected = true
			networkState.connectionAttempts = 0

			// Register this client with the server
			sendMessage({
				type: "register",
				clientCode: networkState.clientCode,
			})
		})

		socket.addEventListener("message", (event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data as string)
				console.log("Received message:", message)

				if (message.type === "registered") {
					networkState.lastSyncTime = message.timestamp
					console.log(
						`Successfully registered with server as client: ${message.clientCode}`,
					)

					// Send initial state after registration
					sendStateUpdate(props.state, props.isPlaying)
				}

				// Handle state updates from other clients
				if (
					message.type === "stateUpdate" &&
					message.clientCode !== networkState.clientCode
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
	if (!networkState.isConnected || !networkState.clientCode) return

	sendMessage({
		type: "stateUpdate",
		clientCode: networkState.clientCode,
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
	}
	
	if (stateUpdateDebounce) {
		clearTimeout(stateUpdateDebounce)
	}
})
</script>

<div class="network-status text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	{#if networkState.isRequestingCode}
		<p>Requesting client code...</p>
	{:else if !networkState.clientCode}
		<p>Initializing client code...</p>
	{:else if networkState.isConnected}
		<p>
			Connected as <span class="font-mono font-bold">{networkState.clientCode}</span>
			{#if networkState.lastSyncTime}
				<span class="block">Last sync: {new Date(networkState.lastSyncTime).toLocaleTimeString()}</span>
			{/if}
		</p>
	{:else}
		<p>Disconnected (Attempt {networkState.connectionAttempts}/5)</p>
	{/if}
</div>
