import { getContext } from "svelte"
import type { Readable } from "svelte/store"

// Create a symbol for the context key
export const TIME_SYNC_CONTEXT_KEY = Symbol("timeSync")

// Define the context interface
export interface TimeSyncContext {
	// Stores
	isInitialized: Readable<boolean>
	isSyncing: Readable<boolean>
	offset: Readable<number>
	isMaster: Readable<boolean>
	peerId: Readable<string | null>

	// Methods
	initialize: (masterPeerId?: string) => Promise<void>
	getSyncedTime: () => number
	getSyncedTimeOrNull: () => number | undefined
	sync: () => Promise<void>
	calculateNextBeatTime: (
		bpm: number,
		beatsPerMeasure: number,
	) => { nextBeatTime: number; beatNumber: number }
}

// Export a function to get the time sync context
export const getTimeSyncContext = (): TimeSyncContext => {
	return getContext<TimeSyncContext>(TIME_SYNC_CONTEXT_KEY)
}
