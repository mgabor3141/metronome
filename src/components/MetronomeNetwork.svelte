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
import * as TimeSync from "../utils/time-sync"

interface MetronomeNetworkProps {
	state: MetronomeState
	onRemoteStateUpdate?: (state: MetronomeState, timestamp?: number) => void
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
		timestamp?: number
	} | null
	isFullyEstablished: boolean
	networkDelay: number
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
	networkDelay: 50 // Default estimate of network delay in ms
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
 * Initializes the client code - either from URL, localStorage, or server
 */
const initializeClientCode = async (): Promise<void> => {
	try {
		// First check if there's a code in the URL
		const urlCode = getCodeFromUrl()
		if (urlCode) {
			console.log(`Using code from URL: ${urlCode}`)
			networkState.clientCode = urlCode
			networkState.joinedViaLink = true
			saveClientCode(urlCode)
			return
		}

		// Then check if there's a code in localStorage
		if (hasClientCode()) {
			const storedCode = getClientCode()
			if (storedCode) {
				console.log(`Using stored code: ${storedCode}`)
				networkState.clientCode = storedCode
				return
			}
		}

		// Otherwise, we'll request a new code from the server
		// This will be handled in the WebSocket connection
		networkState.isRequestingCode = true
	} catch (error) {
		console.error("Failed to initialize client code:", error)
	}
}

/**
 * Sends a message to the WebSocket server
 */
const sendMessage = (message: Record<string, unknown>): void => {
	if (!socket || socket.readyState !== WebSocket.OPEN) {
		console.warn("Cannot send message, WebSocket not open")
		return
	}

	try {
		socket.send(JSON.stringify(message))
	} catch (error) {
		console.error("Failed to send message:", error)
	}
}

/**
 * Establishes a WebSocket connection to the server
 */
const connectToServer = async (): Promise<void> => {
	// Initialize client ID and code before connecting
	networkState.clientId = initializeClientId()
	await initializeClientCode()

	// Increment connection attempts
	networkState.connectionAttempts++

	// Get the WebSocket URL
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const wsUrl = `${protocol}//${window.location.host}/api/ws`

	try {
		console.log(`Connecting to WebSocket server at ${wsUrl}`)
		socket = new WebSocket(wsUrl)

		socket.addEventListener("open", () => {
			console.log("WebSocket connection established")
			networkState.isConnected = true
			networkState.connectionAttempts = 0

			// Register with the server
			sendMessage({
				type: "register",
				clientId: networkState.clientId,
				clientCode: networkState.clientCode,
			})
		})

		socket.addEventListener("message", handleWebSocketMessage)

		socket.addEventListener("close", (event: CloseEvent) => {
			console.log(`WebSocket connection closed: ${event.code} ${event.reason}`)
			networkState.isConnected = false

			// Attempt to reconnect with exponential backoff
			if (networkState.connectionAttempts < 5) {
				const delay = Math.min(1000 * (2 ** networkState.connectionAttempts), 30000)
				console.log(`Reconnecting in ${delay / 1000} seconds...`)
				setTimeout(connectToServer, delay)
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
			
			// Get the timestamp from the message
			const remoteTimestamp = message.timestamp || Date.now()
			
			// Update network delay estimate based on message timestamp
			updateNetworkDelayEstimate(remoteTimestamp)
			
			// Adjust timestamp for network delay and time sync offset
			const adjustedTimestamp = TimeSync.adjustTimestampForNetworkDelay(
				remoteTimestamp,
				networkState.networkDelay
			)
			
			// Calculate time difference for debugging
			const timeDifference = TimeSync.calculateTimeDifference(adjustedTimestamp)
			console.log(`Adjusted timestamp: ${new Date(adjustedTimestamp).toISOString()}, time difference: ${timeDifference}ms`)
			
			// If BPM is included, calculate beat difference for debugging
			if (message.state.bpm) {
				const beatDifference = TimeSync.calculateBeatDifference(
					adjustedTimestamp,
					message.state.bpm
				)
				console.log(`Beat difference: ${beatDifference.toFixed(3)} beats`)
			}
			
			// Store the received state to prevent echo effects
			networkState.lastKnownState = {
				bpm: message.state.bpm,
				timeSignature: {
					beatsPerMeasure: message.state.timeSignature.beatsPerMeasure,
					beatUnit: message.state.timeSignature.beatUnit,
				},
				isPlaying: message.state.isPlaying,
				timestamp: adjustedTimestamp
			}

			// Update local state if callback is provided
			if (props.onRemoteStateUpdate) {
				props.onRemoteStateUpdate(message.state, adjustedTimestamp)
			}

			// Update last sync time
			networkState.lastSyncTime = new Date().toISOString()
		}

		// Handle initial state when joining a group
		if (message.type === "initialState") {
			console.log("Received initial state from server:", message)
			
			// Get the timestamp from the message
			const remoteTimestamp = message.timestamp || Date.now()
			
			// Update network delay estimate based on message timestamp
			updateNetworkDelayEstimate(remoteTimestamp)
			
			// Adjust timestamp for network delay and time sync offset
			const adjustedTimestamp = TimeSync.adjustTimestampForNetworkDelay(
				remoteTimestamp,
				networkState.networkDelay
			)
			
			// Calculate time difference for debugging
			const timeDifference = TimeSync.calculateTimeDifference(adjustedTimestamp)
			console.log(`Adjusted timestamp: ${new Date(adjustedTimestamp).toISOString()}, time difference: ${timeDifference}ms`)
			
			// If BPM is included, calculate beat difference for debugging
			if (message.state.bpm) {
				const beatDifference = TimeSync.calculateBeatDifference(
					adjustedTimestamp,
					message.state.bpm
				)
				console.log(`Beat difference: ${beatDifference.toFixed(3)} beats`)
			}

			// Store the received state to prevent echo effects
			networkState.lastKnownState = {
				bpm: message.state.bpm,
				timeSignature: {
					beatsPerMeasure: message.state.timeSignature.beatsPerMeasure,
					beatUnit: message.state.timeSignature.beatUnit,
				},
				isPlaying: message.state.isPlaying,
				timestamp: adjustedTimestamp
			}

			// Update local state if callback is provided
			if (props.onRemoteStateUpdate) {
				props.onRemoteStateUpdate(message.state, adjustedTimestamp)
			}

			// Update last sync time
			networkState.lastSyncTime = new Date().toISOString()
			console.log("Applied initial group state")

			// Now that we have received the initial state, mark as fully established
			networkState.isFullyEstablished = true
		}

		// Handle client count updates
		if (message.type === "clientCount") {
			networkState.clientsInGroup = message.count
		}
	} catch (error) {
		console.error("Failed to handle WebSocket message:", error)
	}
}

/**
 * Sends a state update to the server
 */
const sendStateUpdate = (state: MetronomeState): void => {
	if (!networkState.isConnected || !networkState.isFullyEstablished) {
		console.warn("Cannot send state update, not fully connected")
		return
	}

	// Compare with last known state to prevent echo effects
	if (
		networkState.lastKnownState &&
		networkState.lastKnownState.bpm === state.bpm &&
		networkState.lastKnownState.timeSignature.beatsPerMeasure === state.timeSignature.beatsPerMeasure &&
		networkState.lastKnownState.timeSignature.beatUnit === state.timeSignature.beatUnit &&
		networkState.lastKnownState.isPlaying === state.isPlaying
	) {
		console.debug("Skipping state update, no changes")
		return
	}

	// Get the current time, preferring synchronized time
	let timestamp: number
	try {
		// Use synchronized time if available
		timestamp = TimeSync.getSyncedTime()
	} catch (error) {
		// Fall back to local time if sync not available
		console.warn("Time sync not available, using local time for state update")
		timestamp = Date.now()
	}

	networkState.lastKnownState = {
		bpm: state.bpm,
		timeSignature: {
			beatsPerMeasure: state.timeSignature.beatsPerMeasure,
			beatUnit: state.timeSignature.beatUnit,
		},
		isPlaying: state.isPlaying,
		timestamp
	}

	sendMessage({
		type: "stateUpdate",
		clientId: networkState.clientId,
		clientCode: networkState.clientCode,
		state,
		timestamp
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
 * Updates the network delay estimate based on message timestamps
 */
const updateNetworkDelayEstimate = (timestamp: number): void => {
	if (!timestamp) return
	
	try {
		// Calculate the time difference between the timestamp and now
		const timeDifference = TimeSync.calculateTimeDifference(timestamp)
		
		// Only use positive time differences (messages from the past)
		// as negative differences could indicate clock drift
		if (timeDifference > 0) {
			// Simple moving average for network delay estimate
			// Assuming half of the time difference is due to network delay
			const newDelayEstimate = Math.min(timeDifference / 2, 500) // Cap at 500ms to avoid extreme values
			
			// Update the network delay estimate with a weighted average
			// Give more weight to the current estimate (0.7) than the new measurement (0.3)
			networkState.networkDelay = networkState.networkDelay * 0.7 + newDelayEstimate * 0.3
			
			console.log(`Updated network delay estimate: ${networkState.networkDelay.toFixed(2)}ms`)
		}
	} catch (error) {
		console.error("Failed to update network delay estimate:", error)
	}
}

/**
 * Creates a shareable link with the current code
 */
const getShareableLink = (): string => {
	if (typeof window === "undefined" || !networkState.clientCode) return ""

	const url = new URL(window.location.href)
	url.searchParams.set("code", networkState.clientCode)
	return url.href
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
		<p>
			Connected with code: <strong>{networkState.clientCode}</strong>
			({networkState.clientsInGroup} {networkState.clientsInGroup === 1 ? "client" : "clients"})
			<button
				class="ml-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
				onclick={copyShareableLink}
			>
				Share
			</button>
		</p>
	{:else}
		<p>Connecting...</p>
	{/if}
</div>
