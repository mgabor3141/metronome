<script lang="ts">
/**
 * MetronomeNetwork component that handles WebSocket connections
 * for synchronizing metronome state across devices and manages PeerJS connections
 */
import { onMount, onDestroy } from "svelte"
import type { MetronomeState } from "./Metronome.svelte"
import { getTimeSyncContext } from "./TimeSync/time-sync"
import { getGroupCode, saveGroupCode } from "../utils/code-utils"

interface MetronomeNetworkProps {
	state: MetronomeState
	onRemoteStateUpdate?: (state: MetronomeState) => void
}

const props: MetronomeNetworkProps = $props()

// Get time sync context
const timeSync = getTimeSyncContext()

// Network state
interface NetworkState {
	peerId: string
	groupCode: string
	isConnected: boolean
	lastSyncTime: string | null
	connectionAttempts: number
	isRequestingCode: boolean
	peersInGroup: number
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
	isMaster: boolean
	masterPeerId: string | null
}

const networkState = $state<NetworkState>({
	peerId: "",
	groupCode: "",
	isConnected: false,
	lastSyncTime: null,
	connectionAttempts: 0,
	isRequestingCode: false,
	peersInGroup: 1,
	joinedViaLink: false,
	lastKnownState: null,
	isFullyEstablished: false,
	isMaster: false,
	masterPeerId: null,
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
 * Fetches a new group code from the server
 */
const requestGroupCode = async (): Promise<string> => {
	networkState.isRequestingCode = true

	try {
		const response = await fetch("/api/group-code")
		const data = await response.json()

		if (data.success && data.code) {
			// Save the code to local storage
			saveGroupCode(data.code)
			console.log(`Received new group code: ${data.code}`)

			// Update URL with the new code
			updateUrlWithCode(data.code)

			return data.code
		}

		throw new Error(data.message || "Failed to get group code")
	} catch (error) {
		console.error("Error requesting group code:", error)
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
		const response = await fetch("/api/group-code", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ code }),
		})

		const data = await response.json()

		if (!data.success) {
			console.error("Failed to register group code:", data.message)
			await requestGroupCode()
		} else {
			console.log(`Registered existing group code: ${code}`)

			// Update URL with the code
			updateUrlWithCode(code)

			networkState.isFullyEstablished = true
		}
	} catch (error) {
		console.error("Error registering group code:", error)
		await requestGroupCode()
	}
}

/**
 * Initializes the group code - either retrieves from URL, local storage, or requests a new one
 */
const initializeGroupCode = async (): Promise<void> => {
	try {
		// First check if there's a code in the URL
		const urlCode = getCodeFromUrl()
		if (urlCode) {
			console.debug(`Using code from URL: ${urlCode}`)
			networkState.groupCode = urlCode
			networkState.joinedViaLink = true

			// Save the code from URL to local storage
			saveGroupCode(urlCode)

			// Register the code with the server
			await registerExistingCode(urlCode)
			return
		}

		// If no URL code, check local storage
		const localCode = getGroupCode()
		if (localCode) {
			networkState.groupCode = localCode
			console.debug(`Using existing client code: ${localCode}`)

			// Update URL with the code
			updateUrlWithCode(localCode)

			await registerExistingCode(localCode)
		} else {
			// No code found, request a new one
			console.debug("No client code found, requesting a new one")
			const newCode = await requestGroupCode()
			networkState.groupCode = newCode
		}
	} catch (error) {
		console.error("Error initializing client code:", error)
		// If all else fails, try to get a new code
		try {
			const newCode = await requestGroupCode()
			networkState.groupCode = newCode
		} catch (fallbackError) {
			console.error("Failed to get client code in fallback:", fallbackError)
		}
	}
}

/**
 * Initializes the WebSocket connection
 */
const initializeWebSocket = (): void => {
	// Close existing connection if any
	if (socket) {
		socket.close()
		socket = null
	}

	// Create a new WebSocket connection
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const wsUrl = `${protocol}//${window.location.host}/ws?clientId=${
		networkState.peerId
	}&code=${networkState.groupCode}`

	socket = new WebSocket(wsUrl)

	// Set up event handlers
	socket.addEventListener("open", handleWebSocketOpen)
	socket.addEventListener("message", handleWebSocketMessage)
	socket.addEventListener("close", handleWebSocketClose)
	socket.addEventListener("error", handleWebSocketError)

	// Increment connection attempts
	networkState.connectionAttempts++
}

/**
 * Handles WebSocket open event
 */
const handleWebSocketOpen = (): void => {
	console.log("WebSocket connection established")
	networkState.isConnected = true
	networkState.connectionAttempts = 0
}

/**
 * Handles WebSocket message event
 */
const handleWebSocketMessage = (event: MessageEvent): void => {
	try {
		const message = JSON.parse(event.data)
		console.debug("Received message:", message)

		switch (message.type) {
			case "welcome":
				handleWelcomeMessage(message)
				break
			case "state_update":
				handleStateUpdateMessage(message)
				break
			case "client_joined":
				handleClientJoinedMessage(message)
				break
			case "client_left":
				handleClientLeftMessage(message)
				break
			default:
				console.warn("Unknown message type:", message.type)
		}
	} catch (error) {
		console.error("Error handling WebSocket message:", error)
	}
}

/**
 * Handles the welcome message from the server
 */
const handleWelcomeMessage = async (message: {
	clientsCount: number
	state?: MetronomeState
	isMaster: boolean
	masterPeerId?: string
}): Promise<void> => {
	console.log(`Welcome message: ${message.clientsCount} clients in group`)

	networkState.peersInGroup = message.clientsCount
	networkState.isFullyEstablished = true
	networkState.isMaster = message.isMaster

	// If we're the master, initialize time sync as master
	if (message.isMaster) {
		try {
			await timeSync.initialize()
			console.log("Initialized as time sync master")
		} catch (error) {
			console.error("Failed to initialize as time sync master:", error)
		}
	}
	// If we're not the master and a master peer ID is provided, connect to it
	else if (message.masterPeerId) {
		networkState.masterPeerId = message.masterPeerId
		try {
			await timeSync.initialize(message.masterPeerId)
			console.log(`Connected to time sync master: ${message.masterPeerId}`)
		} catch (error) {
			console.error("Failed to connect to time sync master:", error)
		}
	}

	// If state is provided in the welcome message, update local state
	if (message.state && props.onRemoteStateUpdate) {
		networkState.lastKnownState = message.state
		props.onRemoteStateUpdate(message.state)
	}
}

/**
 * Handles a state update message from the server
 */
const handleStateUpdateMessage = (message: {
	state: MetronomeState
	timestamp: string
}): void => {
	if (!props.onRemoteStateUpdate) return

	// Update last sync time
	networkState.lastSyncTime = message.timestamp

	// Update last known state
	networkState.lastKnownState = message.state

	// Call the callback to update parent component state
	props.onRemoteStateUpdate(message.state)
}

/**
 * Handles a client joined message from the server
 */
const handleClientJoinedMessage = (message: { clientsCount: number }): void => {
	networkState.peersInGroup = message.clientsCount
	console.log(`Client joined. Total clients: ${message.clientsCount}`)
}

/**
 * Handles a client left message from the server
 */
const handleClientLeftMessage = (message: { clientsCount: number }): void => {
	networkState.peersInGroup = message.clientsCount
	console.log(`Client left. Total clients: ${message.clientsCount}`)
}

/**
 * Handles WebSocket close event
 */
const handleWebSocketClose = (event: CloseEvent): void => {
	console.log(`WebSocket connection closed: ${event.code} ${event.reason}`)
	networkState.isConnected = false

	// Attempt to reconnect after a delay, with exponential backoff
	const backoffTime = Math.min(
		1000 * 2 ** networkState.connectionAttempts,
		30000,
	)
	setTimeout(() => {
		if (!socket || socket.readyState === WebSocket.CLOSED) {
			console.log(
				`Attempting to reconnect (attempt ${networkState.connectionAttempts + 1})`,
			)
			initializeWebSocket()
		}
	}, backoffTime)
}

/**
 * Handles WebSocket error event
 */
const handleWebSocketError = (event: Event): void => {
	console.error("WebSocket error:", event)
}

/**
 * Sends a state update to the server
 */
const sendStateUpdate = (): void => {
	if (
		!socket ||
		socket.readyState !== WebSocket.OPEN ||
		!networkState.isFullyEstablished
	) {
		return
	}

	const message = {
		type: "state_update",
		state: props.state,
		timestamp: new Date().toISOString(),
		peerId: timeSync.peerId,
	}

	socket.send(JSON.stringify(message))
}

// Initialize on component mount
onMount(() => {
	// Set up ping interval to keep connection alive
	const pingInterval = setInterval(() => {
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(JSON.stringify({ type: "ping" }))
		}
	}, 30000) // Send ping every 30 seconds

	// Initialize client ID and start the async initialization process
	networkState.peerId = timeSync.peerId

	// Start the async initialization process without awaiting it
	void (async () => {
		try {
			// Initialize client code first
			await initializeGroupCode()

			// Then initialize WebSocket connection
			initializeWebSocket()
		} catch (error) {
			console.error("Failed to initialize network:", error)
		}
	})()

	// Clean up on component destroy
	return () => {
		clearInterval(pingInterval)
	}
})

// Clean up on component destroy
onDestroy(() => {
	// Close WebSocket connection
	if (socket) {
		socket.close()
		socket = null
	}

	// Clear any pending debounce
	if (stateUpdateDebounce !== null) {
		clearTimeout(stateUpdateDebounce)
		stateUpdateDebounce = null
	}
})

/**
 * Creates a shareable link with the current code
 */
const getShareableLink = (): string => {
	if (typeof window === "undefined" || !networkState.groupCode) return ""

	const url = new URL(window.location.href)
	url.searchParams.set("code", networkState.groupCode)
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

	// Debounce state updates to avoid flooding the server
	if (stateUpdateDebounce !== null) {
		clearTimeout(stateUpdateDebounce)
	}

	stateUpdateDebounce = setTimeout(() => {
		sendStateUpdate()
		stateUpdateDebounce = null
	}, 10) as unknown as number
})
</script>

<div class="network-status text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	{#if networkState.isRequestingCode}
		<p>Requesting client code...</p>
	{:else if !networkState.groupCode}
		<p>Initializing client code...</p>
	{:else if networkState.isConnected}
		<div>
			<p>
				Connected to group <span class="font-mono font-bold">{networkState.groupCode}</span>
				{#if networkState.joinedViaLink}
					<span class="text-blue-500 ml-1">(joined via link)</span>
				{/if}
			</p>
			
			{#if networkState.peersInGroup > 1}
				<p class="mt-1">Group size: {networkState.peersInGroup} clients</p>
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
