/**
 * Time synchronization utility using the timesync library
 * This utility provides functions to synchronize time across clients
 */
// Import timesync with proper type definitions
import timesyncLib from "timesync"

import { writable, derived, get, type Readable } from "svelte/store"

// Define the TimeSyncInstance type since it's not properly exported
interface TimeSyncInstance {
  now(): number
  sync(): void
  destroy(): void
  on(event: string, callback: (data: string | number) => void): void
  off(event: string, callback?: (data: string | number) => void): void
  offset: number
}

// Define the TimeSyncStatic interface for the module itself
interface TimeSyncStatic {
  create(options: {
    server?: string | string[];
    interval?: number;
    delay?: number;
    timeout?: number;
    now?: () => number;
  }): TimeSyncInstance;
}

// Cast the imported module to the correct type
const timesync = timesyncLib as unknown as TimeSyncStatic;

// Type for the sync state
interface SyncState {
  isInitialized: boolean
  isSyncing: boolean
  offset: number
  syncCount: number
  lastSyncTime: number
  error: string | null
}

// Initialize the store for the time sync instance
const timeSync = writable<TimeSyncInstance | null>(null)

// Store for the sync state
const syncState = writable<SyncState>({
  isInitialized: false,
  isSyncing: false,
  offset: 0,
  syncCount: 0,
  lastSyncTime: 0,
  error: null
})

// Readable store for the initialization state
export const isInitialized: Readable<boolean> = derived(
  syncState,
  ($syncState) => $syncState.isInitialized
)

// Readable store for the syncing state
export const isSyncing: Readable<boolean> = derived(
  syncState,
  ($syncState) => $syncState.isSyncing
)

// Readable store for the offset
export const offset: Readable<number> = derived(
  syncState,
  ($syncState) => $syncState.offset
)

// Promise that resolves when the first sync is complete
let initPromise: Promise<void> | null = null
let initResolve: (() => void) | null = null

/**
 * Initialize the time sync instance
 * @returns A promise that resolves when the first sync is complete
 * @throws Error if initialization fails
 */
export const initialize = async (): Promise<void> => {
  // If already initialized, return the existing promise
  if (initPromise) {
    return initPromise
  }

  // Create a new promise that resolves when the first sync is complete
  initPromise = new Promise<void>((resolve) => {
    initResolve = resolve
  })

  try {
    // Create a new timesync instance
    const ts = timesync.create({
      server: "/api/timesync",
      interval: 30000, // 30 seconds between syncs
    })

    // Listen for sync events
    ts.on("sync", (state: string) => {
      console.debug(`Time sync state: ${state}`)
      syncState.update((s) => ({ ...s, isSyncing: state !== "end" }))
    })

    // Listen for change events (offset updates)
    ts.on("change", (offset: number) => {
      console.debug(`Time sync offset: ${offset}ms`)
      syncState.update((s) => ({
        ...s,
        offset,
        isInitialized: true,
        syncCount: s.syncCount + 1,
        lastSyncTime: Date.now(),
        error: null
      }))

      // Resolve the init promise on the first sync
      if (initResolve) {
        initResolve()
        initResolve = null
      }
    })

    // Store the timesync instance
    timeSync.set(ts)

    // Start the sync process
    await sync()

    return initPromise
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    syncState.update((s) => ({ ...s, error: errorMessage }))
    throw error
  }
}

/**
 * Manually trigger a sync
 * @returns A promise that resolves when the sync is complete
 * @throws Error if time sync is not initialized
 */
export const sync = async (): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const ts = get(timeSync)
    
    if (!ts) {
      const error = new Error("Time sync not initialized")
      syncState.update((s) => ({ ...s, error: error.message }))
      reject(error)
      return
    }
    
    // Update the syncing state
    syncState.update((s) => ({ ...s, isSyncing: true }))
    
    // Trigger a sync
    ts.sync()
    
    // Set up a listener for the sync to complete
    const unsubscribe = isSyncing.subscribe((isSyncing) => {
      if (!isSyncing) {
        unsubscribe()
        resolve()
      }
    })
  })
}

/**
 * Get the current synchronized time
 * @returns The current synchronized time in milliseconds
 * @throws Error if time sync is not initialized
 */
export const getSyncedTime = (): number => {
  const ts = get(timeSync)
  const state = get(syncState)

  if (!ts || !state.isInitialized) {
    throw new Error("Time sync not initialized")
  }

  return ts.now()
}

/**
 * Get the current synchronized time or null if not initialized
 * @returns The current synchronized time in milliseconds or null
 */
export const getSyncedTimeOrNull = (): number | null => {
  try {
    return getSyncedTime()
  } catch (error) {
    return null
  }
}

/**
 * Get the current time offset from the server
 * @returns The current time offset in milliseconds
 */
export const getOffset = (): number => {
  return get(syncState).offset
}

/**
 * Calculate the next beat time based on the current time
 * @param bpm The current BPM
 * @param beatsPerMeasure The number of beats per measure
 * @returns The next beat time in milliseconds and the beat number
 */
export const calculateNextBeatTime = (
  bpm: number,
  beatsPerMeasure: number
): { nextBeatTime: number; beatNumber: number } => {
  const now = getSyncedTime()
  const secondsPerBeat = 60 / bpm
  const millisecondsPerBeat = secondsPerBeat * 1000

  // Calculate how far we are into the current beat
  const beatsSinceEpoch = now / millisecondsPerBeat
  const currentBeatFraction = beatsSinceEpoch % 1
  
  // Calculate time until next beat
  const timeToNextBeat = (1 - currentBeatFraction) * millisecondsPerBeat
  
  // Calculate the next beat time
  const nextBeatTime = now + timeToNextBeat
  
  // Calculate the beat number (0-indexed)
  const nextBeatNumber = Math.floor(beatsSinceEpoch + 1) % beatsPerMeasure

  return { nextBeatTime, beatNumber: nextBeatNumber }
}

/**
 * Calculate the beat position at a specific timestamp
 * @param timestamp The timestamp to calculate the beat position for
 * @param bpm The current BPM
 * @param beatsPerMeasure The number of beats per measure
 * @returns The beat position (beat number and fraction within the beat)
 */
export const calculateBeatPosition = (
  timestamp: number,
  bpm: number,
  beatsPerMeasure: number
): { beatNumber: number; beatFraction: number } => {
  const secondsPerBeat = 60 / bpm
  const millisecondsPerBeat = secondsPerBeat * 1000

  // Calculate beats since epoch
  const beatsSinceEpoch = timestamp / millisecondsPerBeat
  
  // Calculate the beat number (0-indexed)
  const beatNumber = Math.floor(beatsSinceEpoch) % beatsPerMeasure
  
  // Calculate the fraction within the current beat
  const beatFraction = beatsSinceEpoch % 1

  return { beatNumber, beatFraction }
}

/**
 * Calculate the time difference between a remote timestamp and the current time
 * @param remoteTimestamp The remote timestamp in milliseconds
 * @returns The time difference in milliseconds (positive if remote is in the past)
 */
export const calculateTimeDifference = (remoteTimestamp: number): number => {
  try {
    const localTime = getSyncedTime()
    return localTime - remoteTimestamp
  } catch (error) {
    console.error("Failed to calculate time difference:", error)
    return 0
  }
}

/**
 * Calculate the beat position difference between a remote timestamp and now
 * @param remoteTimestamp The remote timestamp in milliseconds
 * @param bpm The current BPM
 * @returns The beat difference (how many beats have passed since the remote timestamp)
 */
export const calculateBeatDifference = (
  remoteTimestamp: number,
  bpm: number
): number => {
  const timeDifference = calculateTimeDifference(remoteTimestamp)
  const secondsPerBeat = 60 / bpm
  const millisecondsPerBeat = secondsPerBeat * 1000
  
  return timeDifference / millisecondsPerBeat
}

/**
 * Adjust a timestamp for network delay and time sync offset
 * @param timestamp The timestamp to adjust
 * @param networkDelay The estimated network delay in milliseconds
 * @returns The adjusted timestamp
 */
export const adjustTimestampForNetworkDelay = (
  timestamp: number,
  networkDelay = 0
): number => {
  // Adjust for half the network delay (assuming symmetric delay)
  return timestamp + (networkDelay / 2)
}

// Initialize time sync on module load
initialize().catch(err => {
  console.error("Failed to initialize TimeSync:", err)
})
