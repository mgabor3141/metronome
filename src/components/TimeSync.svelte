<!--
  TimeSync component for synchronizing time between clients
  This component has no UI and is used to provide synchronized time
  to other components like MetronomeAudio
-->
<script lang="ts" module>
import { create, type TimeSyncInstance } from "timesync"

// Track initialization state
let ts: TimeSyncInstance | null = null
let isInitialized = $state(false)
let initializationPromise: Promise<void> | null = null

/**
 * Initialize the timesync instance if not already initialized
 * Returns a promise that resolves when initialization is complete
 */
export const initializeTimeSync = async (): Promise<void> => {
	if (isInitialized) return Promise.resolve()

	if (initializationPromise) return initializationPromise

	initializationPromise = new Promise((resolve, reject) => {
		try {
			// Create a new timesync instance
			ts = create({
				server: "/api/timesync",
				interval: 5_000, // Synchronize every 5 seconds
			})

			// Set up event listeners
			ts.on("sync", (state) => {
				if ((state as "start" | "end") === "end") {
					console.log("TimeSync initialized successfully")
					isInitialized = true
					resolve()
				}
			})

			// Listen for error events
			ts.on("error", (err) => {
				console.error("TimeSync error:", err)
				reject(err)
			})

			// Trigger initial sync
			ts.sync()
		} catch (error) {
			console.error("Error initializing TimeSync:", error)
			reject(error)
		}
	})

	return initializationPromise
}

/**
 * Get the synchronized time
 */
export const getSyncedTime = (): number => {
	if (!ts) {
		console.error("TimeSync instance not initialized")
		return Date.now()
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
 * Check if TimeSync is initialized
 */
export const isTimeSyncInitialized = (): boolean => {
	return isInitialized
}
</script>

<script lang="ts">
	import { onMount, onDestroy } from "svelte"
	
	// Sync status state
	const syncStatus = $state({
		syncing: false,
		lastSync: null as string | null,
		offset: 0,
		error: null as string | null,
	})

	// Initialize timesync when the component mounts
	onMount(() => {
		initializeTimeSync().then(() => {
			// Set up additional event listeners after initialization
			if (ts) {
				// Listen for sync events
				ts.on("sync", (state) => {
					syncStatus.syncing = (state as "start" | "end") === "start"
					if (state === "end") {
						syncStatus.lastSync = new Date().toISOString()
					}
				})

				// Listen for change events
				ts.on("change", (offset) => {
					syncStatus.offset = offset as number
					console.log(`Time offset changed: ${offset}ms`)
				})
			}
		}).catch(error => {
			syncStatus.error = error instanceof Error ? error.message : String(error)
		})
	})

	// Clean up when the component is destroyed
	onDestroy(() => {
		if (ts) {
			ts.destroy()
			ts = null
			isInitialized = false
			initializationPromise = null
		}
	})
</script>
