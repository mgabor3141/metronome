<script lang="ts">
/**
 * MetronomeNetwork component that handles WebSocket connections
 * for synchronizing metronome state across devices
 */
import { onMount, onDestroy } from "svelte"
import type { MetronomeState } from "./Metronome.svelte"
import {
	getClientCode,
	hasClientCode,
	saveClientCode,
	generateClientId,
	clearClientCode,
} from "../utils/code-utils"

interface MetronomeNetworkProps {
	state: MetronomeState
	onRemoteStateUpdate?: (state: MetronomeState) => void
}

const props: MetronomeNetworkProps = $props()

// Network state
interface NetworkState {
	clientId: string
	clientCode: string
	isConnected: boolean
	lastSyncTime: string | null
	connectionAttempts: number
	isRequestingCode: boolean
	clientsInGroup: number
	joinedViaLink: boolean
	lastKnownState: {
		bpm: number
		timeSignature: {
			beatsPerMeasure: number
			beatUnit: number
		}
		isPlaying: boolean
	} | null
	isFullyEstablished: boolean
}

const networkState = $state<NetworkState>({
	clientId: "",
	clientCode: "",
	isConnected: false,
	lastSyncTime: null,
	connectionAttempts: 0,
	isRequestingCode: false,
	clientsInGroup: 1,
	joinedViaLink: false,
	lastKnownState: null,
	isFullyEstablished: false,
})

// WebSocket connection
let socket: WebSocket | null = null
// Debounce timer for state updates
let stateUpdateDebounce: number | null = null

/**
 * Gets a code from the URL query parameter if present
 */
const getCodeFromUrl = (): string | null => {
	if (typeof window === "undefined") return null

	const urlParams = new URLSearchParams(window.location.search)
	const code = urlParams.get("code")

	// Validate the code format (4 uppercase letters)
	if (code && /^[A-Z]{4}$/.test(code)) {
		return code
	}

	return null
}

/**
 * Updates the URL with the current code
 */
const updateUrlWithCode = (code: string): void => {
	if (typeof window === "undefined") return

	const url = new URL(window.location.href)
	url.searchParams.set("code", code)

	// Update the URL without reloading the page
	window.history.replaceState({}, "", url.toString())
}

/**
 * Initializes the client ID - generates a new UUID for each connection
 */
const initializeClientId = (): string => {
	// Always generate a new UUID for each connection
	const newId = generateClientId()
	console.log(`Generated new client ID: ${newId}`)
	return newId
}

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

			// Update URL with the new code
			updateUrlWithCode(data.code)

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

			// Update URL with the code
			updateUrlWithCode(code)

			networkState.isFullyEstablished = true
		}
	} catch (error) {
		console.error("Error registering client code:", error)
		await requestClientCode()
	}
}

/**
 * Initializes the client code - either retrieves from URL, local storage, or requests a new one
 */
const initializeClientCode = async (): Promise<void> => {
	try {
		// First check if there's a code in the URL
		const urlCode = getCodeFromUrl()
		if (urlCode) {
			console.debug(`Using code from URL: ${urlCode}`)
			networkState.clientCode = urlCode
			networkState.joinedViaLink = true

			// Save the code from URL to local storage
			saveClientCode(urlCode)

			// Register the code with the server
			await registerExistingCode(urlCode)
			return
		}

		// If no URL code, check local storage
		if (hasClientCode()) {
			// Use existing code from local storage
			const code = getClientCode()
			if (code) {
				networkState.clientCode = code
				console.debug(`Using existing client code: ${code}`)

				// Update URL with the code
				updateUrlWithCode(code)

				await registerExistingCode(code)
			} else {
				throw new Error(
					"Client code is null despite hasClientCode() returning true",
				)
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
 * Checks if the current state is the same as the last received state from the network
 * to prevent echo effects
 */
const isStateFromNetwork = (state: MetronomeState): boolean => {
	if (!networkState.lastKnownState) return false

	return (
		state.bpm === networkState.lastKnownState.bpm &&
		state.timeSignature.beatsPerMeasure ===
			networkState.lastKnownState.timeSignature.beatsPerMeasure &&
		state.timeSignature.beatUnit ===
			networkState.lastKnownState.timeSignature.beatUnit &&
		state.isPlaying === networkState.lastKnownState.isPlaying
	)
}

/**
 * Establishes WebSocket connection to the server
 */
const connectToServer = async (): Promise<void> => {
	// Initialize client ID
	networkState.clientId = initializeClientId()

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

	console.log(
		`Connecting to WebSocket server at ${wsUrl} as ${networkState.clientId} in group ${networkState.clientCode}`,
	)

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
				clientCode: networkState.clientCode,
			})
		})

		socket.addEventListener("message", handleWebSocketMessage)

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
 * Handles WebSocket messages
 */
const handleWebSocketMessage = (event: MessageEvent): void => {
	try {
		const message = JSON.parse(event.data)
		console.debug("Received message:", message)

		// Handle registration confirmation
		if (message.type === "registered") {
			console.log(`Successfully registered with code: ${message.clientCode}`)
			networkState.clientCode = message.clientCode
			updateUrlWithCode(message.clientCode)

			// If we didn't join via a link, we're creating a new group
			// so we're fully established after registration
			if (!networkState.joinedViaLink) {
				networkState.isFullyEstablished = true
				sendStateUpdate(props.state)
			}
		}

		// Handle state updates from other clients
		if (
			message.type === "stateUpdate" &&
			message.clientId !== networkState.clientId &&
			message.clientCode === networkState.clientCode
		) {
			console.log("Received state update from another client:", message)

			// Store the received state to prevent echo effects
			networkState.lastKnownState = {
				bpm: message.state.bpm,
				timeSignature: {
					beatsPerMeasure: message.state.timeSignature.beatsPerMeasure,
					beatUnit: message.state.timeSignature.beatUnit,
				},
				isPlaying: message.state.isPlaying,
			}

			// Update local state if callback is provided
			if (props.onRemoteStateUpdate) {
				props.onRemoteStateUpdate(message.state)
			}

			// Update last sync time
			networkState.lastSyncTime = new Date().toISOString()
		}

		// Handle initial state when joining a group
		if (message.type === "initialState") {
			console.log("Received initial state from server:", message)

			// Store the received state to prevent echo effects
			networkState.lastKnownState = {
				bpm: message.state.bpm,
				timeSignature: {
					beatsPerMeasure: message.state.timeSignature.beatsPerMeasure,
					beatUnit: message.state.timeSignature.beatUnit,
				},
				isPlaying: message.state.isPlaying,
			}

			// Update local state if callback is provided
			if (props.onRemoteStateUpdate) {
				props.onRemoteStateUpdate(message.state)
			}

			// Update last sync time
			networkState.lastSyncTime = new Date().toISOString()
			console.log("Applied initial group state")

			// Now that we have received the initial state, mark as fully established
			networkState.isFullyEstablished = true
		}

		// Handle group size updates
		if (message.type === "groupUpdate") {
			networkState.clientsInGroup = message.clientsInGroup
			console.log(
				`Group size updated: ${message.clientsInGroup} clients in group ${message.clientCode}`,
			)
		}
	} catch (error) {
		console.error("Error processing incoming message:", error)
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
const sendStateUpdate = (state: MetronomeState): void => {
	// Don't send updates if not connected, not in a group, or not fully established
	console.log($state.snapshot(networkState))

	if (
		!networkState.isConnected ||
		!networkState.clientCode ||
		!networkState.isFullyEstablished
	) {
		console.log("Skipping state update: not fully established with server")
		return
	}

	// Don't send updates that originated from the network
	if (isStateFromNetwork(state)) {
		console.log("Skipping state update that originated from the network")
		return
	}

	networkState.lastKnownState = {
		bpm: state.bpm,
		timeSignature: {
			beatsPerMeasure: state.timeSignature.beatsPerMeasure,
			beatUnit: state.timeSignature.beatUnit,
		},
		isPlaying: state.isPlaying,
	}

	sendMessage({
		type: "stateUpdate",
		clientId: networkState.clientId,
		clientCode: networkState.clientCode,
		state,
	})

	networkState.lastSyncTime = new Date().toISOString()
}

/**
 * Debounced state update to prevent flooding the server
 */
const debouncedStateUpdate = (state: MetronomeState): void => {
	if (stateUpdateDebounce) {
		clearTimeout(stateUpdateDebounce)
	}

	stateUpdateDebounce = setTimeout(() => {
		sendStateUpdate(state)
		stateUpdateDebounce = null
	}, 10) as unknown as number
}

/**
 * Creates a shareable link with the current code
 */
const getShareableLink = (): string => {
	if (typeof window === "undefined" || !networkState.clientCode) return ""

	const url = new URL(window.location.href)
	url.searchParams.set("code", networkState.clientCode)
	return url.toString()
}

/**
 * Copies the shareable link to the clipboard
 */
const copyShareableLink = async (): Promise<void> => {
	const link = getShareableLink()

	try {
		await navigator.clipboard.writeText(link)
		alert("Link copied to clipboard!")
	} catch (error) {
		console.error("Failed to copy link:", error)
		alert(`Failed to copy link. Please copy it manually: ${link}`)
	}
}

// Watch for state changes to sync with server
$effect(() => {
	// Skip if not connected or not fully established
	if (!networkState.isConnected || !networkState.isFullyEstablished) return

	// Send state updates to the server with debouncing
	debouncedStateUpdate(props.state)
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
		<div>
			<p>
				Connected to group <span class="font-mono font-bold">{networkState.clientCode}</span>
				{#if networkState.joinedViaLink}
					<span class="text-blue-500 ml-1">(joined via link)</span>
				{/if}
			</p>
			
			{#if networkState.clientsInGroup > 1}
				<p class="mt-1">Group size: {networkState.clientsInGroup} clients</p>
			{/if}
			
			{#if networkState.lastSyncTime}
				<p class="mt-1">Last sync: {new Date(networkState.lastSyncTime).toLocaleTimeString()}</p>
			{/if}
			
			<button 
				class="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
				onclick={copyShareableLink}
			>
				Share Link
			</button>
		</div>
	{:else}
		<p>Disconnected (Attempt {networkState.connectionAttempts}/5)</p>
	{/if}
</div>
