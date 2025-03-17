<script lang="ts">
import type { DataConnection, Peer } from "peerjs"
/**
 * TimeSyncProvider component
 * Provides time synchronization context to child components using PeerJS
 */
import { onDestroy, setContext } from "svelte"
import { derived, get, writable } from "svelte/store"
import * as timesync from "timesync"
import { TIME_SYNC_CONTEXT_KEY, type TimeSyncContext } from "./time-sync"

// Define the time sync state interface
interface TimeSyncState {
	isMaster: boolean
	peerId: string | null
	masterPeerId: string | null
	isInitialized: boolean
	isSyncing: boolean
	offset: number
	connections: Record<string, boolean>
	error: string | null
}

// Create the state store
const syncState = writable<TimeSyncState>({
	isMaster: false,
	peerId: null,
	masterPeerId: null,
	isInitialized: false,
	isSyncing: false,
	offset: 0,
	connections: {},
	error: null,
})

// PeerJS and timesync instances
let peer: Peer | null = null
let ts: timesync.TimeSyncInstance | null = null
const peerConnections: Record<string, DataConnection> = {}

// Create derived stores for the context
const isInitialized = derived(syncState, ($state) => $state.isInitialized)
const isSyncing = derived(syncState, ($state) => $state.isSyncing)
const offset = derived(syncState, ($state) => $state.offset)
const isMaster = derived(syncState, ($state) => $state.isMaster)
const peerId = derived(syncState, ($state) => $state.peerId)

/**
 * Gets the current synchronized time in milliseconds
 */
const getSyncedTime = (): number => {
	if (!ts) {
		throw new Error("TimeSync not initialized")
	}
	return ts.now()
}

/**
 * Gets the current synchronized time or undefined if not initialized
 */
const getSyncedTimeOrNull = (): number | undefined => {
	if (!ts) {
		return undefined
	}
	return ts.now()
}

/**
 * Triggers a manual synchronization
 */
const sync = async (): Promise<void> => {
	if (!ts || get(syncState).isMaster) {
		return Promise.resolve()
	}

	return new Promise<void>((resolve) => {
		syncState.update(($state) => ({ ...$state, isSyncing: true }))
		ts?.sync()

		// Resolve after a short delay to allow sync to complete
		setTimeout(() => {
			syncState.update(($state) => ({ ...$state, isSyncing: false }))
			resolve()
		}, 1000)
	})
}

/**
 * Calculates the time of the next beat based on BPM and current synchronized time
 */
const calculateNextBeatTime = (
	bpm: number,
	beatsPerMeasure: number,
): { nextBeatTime: number; beatNumber: number } => {
	if (!ts) {
		throw new Error("TimeSync not initialized")
	}

	// Get the current synchronized time
	const now = ts.now()

	// Calculate beat duration in milliseconds
	const beatDuration = 60000 / bpm

	// Calculate the measure duration
	const measureDuration = beatDuration * beatsPerMeasure

	// Calculate how far we are into the current measure
	const positionInPattern = now % measureDuration

	// Calculate how far we are into the current beat
	const positionInBeat = positionInPattern % beatDuration

	// Calculate time until next beat
	const timeUntilNextBeat = beatDuration - positionInBeat

	// Calculate the next beat time
	const nextBeatTime = now + timeUntilNextBeat

	// Calculate which beat number it will be (0-indexed)
	const currentBeatNumber = Math.floor(positionInPattern / beatDuration)
	const nextBeatNumber = (currentBeatNumber + 1) % beatsPerMeasure

	return {
		nextBeatTime,
		beatNumber: nextBeatNumber,
	}
}

/**
 * Initializes the time synchronization
 * If masterPeerId is provided, this client will sync with that peer
 * Otherwise, this client will be the master
 */
const initialize = async (masterPeerId?: string): Promise<void> => {
	// If already initialized, return resolved promise
	if (get(syncState).isInitialized) {
		return Promise.resolve()
	}

	syncState.update(($state) => ({ ...$state, isSyncing: true }))

	try {
		// Dynamically import PeerJS (it's a browser-only library)
		const { Peer } = await import("peerjs")

		// If masterPeerId is provided, we are not the master
		if (masterPeerId) {
			syncState.update(($state) => ({
				...$state,
				isMaster: false,
				masterPeerId,
			}))

			// Create a new peer with a random ID
			peer = new Peer()
		} else {
			// We are the master, create a peer with a random ID
			syncState.update(($state) => ({ ...$state, isMaster: true }))
			peer = new Peer()
		}

		// Wait for the peer to open
		await new Promise<void>((resolve, reject) => {
			if (!peer) {
				reject(new Error("Failed to create peer"))
				return
			}

			peer.on("open", (id) => {
				console.log(`PeerJS: Connected with ID: ${id}`)
				syncState.update(($state) => ({ ...$state, peerId: id }))
				resolve()
			})

			peer.on("error", (err) => {
				console.error("PeerJS error:", err)
				syncState.update(($state) => ({ ...$state, error: err.message }))
				reject(err)
			})
		})

		// Set up timesync
		if (get(syncState).isMaster) {
			// Master doesn't need to sync with anyone
			ts = timesync.create({
				peers: [],
				interval: undefined, // No automatic syncing for master
			})

			// Set up connection handler for incoming connections
			peer.on("connection", setupConnection)
		} else {
			// Connect to the master peer
			const masterPeerIdValue = get(syncState).masterPeerId
			if (masterPeerIdValue) {
				const conn = peer.connect(masterPeerIdValue)
				setupConnection(conn)

				// Create timesync instance for syncing with master
				ts = timesync.create({
					peers: [masterPeerIdValue],
					interval: 10000, // Sync every 10 seconds to account for drift
					delay: 200,
					timeout: 1000,
				})

				// Configure the send function to use PeerJS
				ts.send = (id: string, data: unknown): Promise<void> => {
					const conn = peerConnections[id]
					if (conn?.open) {
						conn.send(data)
					} else {
						console.error(`Cannot send message: not connected to ${id}`)
					}
					return Promise.resolve()
				}

				// Set up sync event handlers
				ts.on("sync", (state: unknown) => {
					const syncStateValue = state as "start" | "end"
					syncState.update(($state) => ({
						...$state,
						isSyncing: syncStateValue === "start",
					}))
					console.log(`Time sync: ${syncStateValue}`)
				})

				// Listen for offset changes
				ts.on("change", (offsetValue: unknown) => {
					const newOffset = offsetValue as number
					syncState.update(($state) => ({ ...$state, offset: newOffset }))
					console.log(`Time offset changed: ${newOffset}ms`)
				})

				// Trigger initial sync
				ts.sync()
			}
		}

		syncState.update(($state) => ({
			...$state,
			isInitialized: true,
			isSyncing: false,
		}))
	} catch (error) {
		console.error("Error initializing PeerJS and TimeSync:", error)
		syncState.update(($state) => ({
			...$state,
			error: error instanceof Error ? error.message : String(error),
			isSyncing: false,
		}))
		throw error
	}
}

/**
 * Set up a peer connection
 */
const setupConnection = (conn: DataConnection): void => {
	conn.on("open", () => {
		console.log(`Connected with peer: ${conn.peer}`)
		peerConnections[conn.peer] = conn
		syncState.update(($state) => ({
			...$state,
			connections: { ...$state.connections, [conn.peer]: true },
		}))
	})

	conn.on("data", (data) => {
		// Handle timesync data
		if (ts && !get(syncState).isMaster) {
			ts.receive(conn.peer, data)
		}
	})

	conn.on("close", () => {
		console.log(`Disconnected from peer: ${conn.peer}`)
		delete peerConnections[conn.peer]
		syncState.update(($state) => ({
			...$state,
			connections: { ...$state.connections, [conn.peer]: false },
		}))
	})

	conn.on("error", (err) => {
		console.error(`Connection error with ${conn.peer}:`, err)
	})
}

// Create the context object
const timeSyncContext: TimeSyncContext = {
	isInitialized,
	isSyncing,
	offset,
	isMaster,
	peerId,

	initialize,
	getSyncedTime,
	getSyncedTimeOrNull,
	sync,
	calculateNextBeatTime,
}

// Set the context for child components
setContext(TIME_SYNC_CONTEXT_KEY, timeSyncContext)

// Clean up on component destroy
onDestroy(() => {
	// Close all connections
	for (const conn of Object.values(peerConnections)) {
		if (conn.open) {
			conn.close()
		}
	}

	// Close the peer connection
	if (peer) {
		peer.destroy()
		peer = null
	}

	// Clear timesync
	ts = null
})
</script>

<slot />
