/**
 * Time synchronization utility for metronome
 * Provides functions to synchronize time between clients
 */
import { create, type TimeSyncInstance } from "timesync"
import { writable, derived, type Readable, get } from "svelte/store"

// Internal state
type TimeSyncState = {
	isInitialized: boolean
	syncing: boolean
	lastSync: string | null
	offset: number
	error: string | null
}

// Create a timesync instance
let ts: TimeSyncInstance | null = null
let initializationPromise: Promise<void> | null = null

// Create stores for reactive state
const syncState = writable<TimeSyncState>({
	isInitialized: false,
	syncing: false,
	lastSync: null,
	offset: 0,
	error: null
})

// Derived store for initialization status
export const isInitialized: Readable<boolean> = derived(
	syncState,
	$state => $state.isInitialized
)

// Derived store for syncing status
export const isSyncing: Readable<boolean> = derived(
	syncState,
	$state => $state.syncing
)

/**
 * Initialize the timesync instance if not already initialized
 * Returns a promise that resolves when initialization is complete
 */
export const initialize = async (): Promise<void> => {
	// Get current state
	const currentState = get(syncState)
	
	// If already initialized, return resolved promise
	if (currentState.isInitialized) {
		return Promise.resolve()
	}

	// If already initializing, return existing promise
	if (initializationPromise) {
		return initializationPromise
	}

	// Create new initialization promise
	initializationPromise = new Promise((resolve, reject) => {
		try {
			// Create a new timesync instance if it doesn't exist
			if (!ts) {
				ts = create({
					server: "/api/timesync",
					interval: 60_000 // Sync every minute to account for drift
				})

				// Set up event listeners for future syncs
				ts.on("sync", (state) => {
					const syncEventState = state as "start" | "end"
					
					// Update sync state
					syncState.update(currentState => ({
						...currentState,
						syncing: syncEventState === "start",
						lastSync: syncEventState === "end" ? new Date().toISOString() : currentState.lastSync,
						isInitialized: syncEventState === "end" ? true : currentState.isInitialized
					}))
				})

				// Listen for change events
				ts.on("change", (offset) => {
					const offsetValue = offset as number
					syncState.update(state => ({
						...state,
						offset: offsetValue
					}))
					console.log(`Time offset changed: ${offsetValue}ms`)
				})

				// Listen for error events
				ts.on("error", (err) => {
					const error = err as Error
					console.error("TimeSync error:", error)
					syncState.update(state => ({
						...state,
						error: error.message
					}))
					reject(error)
				})
			}

			// Create a one-time sync handler to resolve the promise
			const onSyncComplete = (state: unknown) => {
				const syncEventState = state as "start" | "end"
				
				if (syncEventState === "end") {
					// Remove this one-time handler
					ts?.off("sync", onSyncComplete)
					
					console.log("TimeSync initialized successfully, offset:", ts?.offset)
					
					// Update state and resolve promise
					syncState.update(currentState => ({
						...currentState,
						isInitialized: true,
						lastSync: new Date().toISOString()
					}))
					
					resolve()
				}
			}
			
			// Add the one-time sync handler
			ts?.on("sync", onSyncComplete)

			// Trigger sync
			ts?.sync()
		} catch (error) {
			console.error("Error initializing TimeSync:", error)
			syncState.update(state => ({
				...state,
				error: error instanceof Error ? error.message : String(error)
			}))
			reject(error)
		}
	})

	return initializationPromise
}

/**
 * Get the synchronized time
 * @throws Error if time sync is not initialized
 */
export const getSyncedTime = (): number => {
	if (!ts || !get(syncState).isInitialized) {
		throw new Error("TimeSync not initialized")
	}

	return ts.now()
}

/**
 * Safely get the synchronized time
 * @returns The synchronized time or null if not initialized
 */
export const getSyncedTimeOrNull = (): number | null => {
	if (!ts || !get(syncState).isInitialized) {
		return null
	}

	return ts.now()
}

/**
 * Get the offset from local time
 */
export const getOffset = (): number => {
	return ts ? ts.offset : 0
}

/**
 * Manually trigger a synchronization
 * Note: This should rarely be needed as sync happens automatically
 */
export const sync = (): void => {
	if (ts && !get(syncState).syncing) {
		ts.sync()
	}
}

/**
 * Calculate the next beat time based on synchronized time
 * @param bpm Beats per minute
 * @param beatsPerMeasure Number of beats per measure
 * @param startBeatNumber Optional beat number to start on (default: next beat)
 * @throws Error if time sync is not initialized
 */
export const calculateNextBeatTime = (
	bpm: number,
	beatsPerMeasure: number,
	startBeatNumber?: number
): { nextBeatTime: number; beatNumber: number } => {
	// Get synchronized time in milliseconds
	const syncedTimeMs = getSyncedTimeOrNull() ?? Date.now()
	
	// Calculate beat duration in milliseconds
	const beatDurationMs = (60 / bpm) * 1000
	const measureDurationMs = beatDurationMs * beatsPerMeasure
	
	// Calculate current position in the measure
	const currentMeasureNumber = Math.floor(syncedTimeMs / measureDurationMs)
	const positionInMeasureMs = syncedTimeMs % measureDurationMs
	const currentBeatInMeasure = Math.floor(positionInMeasureMs / beatDurationMs)
	
	// If startBeatNumber is provided, calculate the time for that specific beat
	if (startBeatNumber !== undefined) {
		// Determine if we need to wait for the next measure
		const targetBeatNumber = startBeatNumber % beatsPerMeasure
		const nextMeasureNumber = 
			currentBeatInMeasure > targetBeatNumber ? 
			currentMeasureNumber + 1 : 
			currentMeasureNumber
		
		// Calculate the exact time for the target beat
		const nextBeatTime = nextMeasureNumber * measureDurationMs + 
			targetBeatNumber * beatDurationMs
		
		return { 
			nextBeatTime,
			beatNumber: targetBeatNumber
		}
	}
	
	// Otherwise, calculate the next beat time
	const nextBeatInMeasure = (currentBeatInMeasure + 1) % beatsPerMeasure
	const nextMeasureNumber = 
		nextBeatInMeasure === 0 ? 
		currentMeasureNumber + 1 : 
		currentMeasureNumber
	
	const nextBeatTime = nextMeasureNumber * measureDurationMs + 
		nextBeatInMeasure * beatDurationMs
	
	return { 
		nextBeatTime,
		beatNumber: nextBeatInMeasure
	}
}

/**
 * Clean up resources
 */
export const destroy = (): void => {
	if (ts) {
		ts.destroy()
		ts = null
		initializationPromise = null
		syncState.set({
			isInitialized: false,
			syncing: false,
			lastSync: null,
			offset: 0,
			error: null
		})
	}
}

// Initialize on module load
initialize().catch(err => {
	console.error("Failed to initialize TimeSync:", err)
})
