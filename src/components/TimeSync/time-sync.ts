import { type DataConnection, Peer } from "peerjs"
import { getContext, setContext } from "svelte"
import timesync from "timesync"

// Define the time sync state interface
export type TimeSyncState = {
	isMaster: boolean
	peerId: string
	masterPeerId: string | null
	offset: number
	connections: Record<string, boolean>
}

// Create the state store
const syncState: TimeSyncState = {
	isMaster: false,
	peerId: "",
	masterPeerId: null,
	offset: 0,
	connections: {},
}

// Create a symbol for the context key
export const TIME_SYNC_CONTEXT_KEY = Symbol("timeSync")

// Set the context for child components
setContext(TIME_SYNC_CONTEXT_KEY, syncState)

// Export a function to get the time sync context
export const getTimeSyncContext = (): TimeSyncState => {
	return getContext<TimeSyncState>(TIME_SYNC_CONTEXT_KEY)
}

// PeerJS and timesync instances
let peer: Peer | null = null
let ts: timesync.TimeSyncInstance | null = null
const peerConnections: Record<string, DataConnection> = {}

/**
 * Initializes the time synchronization
 * If masterPeerId is provided, this client will sync with that peer
 * Otherwise, this client will be the master
 */
export const initializePeer = async (): Promise<void> => {
	try {
		// Register as a new peer with a random ID
		peer = new Peer()

		// Wait for the peer to open
		await new Promise<void>((resolve, reject) => {
			if (!peer) {
				reject(new Error("Failed to create peer"))
				return
			}

			peer.on("open", (id) => {
				console.log(`PeerJS: Registered with ID: ${id}`)
				syncState.peerId = id
				resolve()
			})

			peer.on("error", (err) => {
				console.error("PeerJS error:", err)
				reject(err)
			})
		})

		// Set up timesync
		ts = timesync.create({
			peers: [],
		})

		// Set up connection handler for incoming connections
		peer.on("connection", setupConnection)

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
			console.log(`Time sync ${syncStateValue}`)
		})

		// Listen for offset changes
		ts.on("change", (offsetValue: unknown) => {
			const newOffset = offsetValue as number
			syncState.offset = newOffset
			console.log(`Time offset changed: ${newOffset}ms`)
		})
	} catch (error) {
		console.error("Error initializing PeerJS and TimeSync:", error)
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
		syncState.connections[conn.peer] = true
	})

	conn.on("data", (data) => {
		// Handle timesync data
		if (ts && !syncState.isMaster) {
			ts.receive(conn.peer, data)
		}
	})

	conn.on("close", () => {
		console.log(`Disconnected from peer: ${conn.peer}`)
		delete peerConnections[conn.peer]
		syncState.connections[conn.peer] = false
	})

	conn.on("error", (err) => {
		console.error(`Connection error with ${conn.peer}:`, err)
	})
}

export const cleanupPeer = () => {
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
}

/**
 * Calculates the time of the next beat based on BPM and current synchronized time
 */
export const calculateNextBeatTime = (
	bpm: number,
	beatsPerMeasure: number,
): { nextBeatTime: number; beatNumber: number } => {
	// Get the current synchronized time
	const now = ts?.now() ?? new Date().getTime()

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
