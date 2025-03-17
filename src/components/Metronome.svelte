<script lang="ts" module>
/**
 * Interface for the metronome state
 */
export interface TimeSignature {
	beatsPerMeasure: number
	beatUnit: number
}

export interface MetronomeState {
	bpm: number
	timeSignature: TimeSignature
	isPlaying: boolean
}

/**
 * Type for partial state updates
 */
import type { DeepPartial } from "../utils/object-utils"
export type PartialTimeSignature = DeepPartial<TimeSignature>
export type PartialMetronomeState = DeepPartial<MetronomeState>
</script>

<script lang="ts">
/**
 * Metronome component that manages tempo and time signature
 * This component owns the state and delegates UI rendering to MetronomeUI
 */
import MetronomeUI from "./MetronomeUI.svelte"
import MetronomeAudio from "./MetronomeAudio.svelte"
import MetronomeNetwork from "./MetronomeNetwork.svelte"
import { deepMergeIfChanged } from "../utils/object-utils"
import * as TimeSync from "../utils/time-sync"

// Raw state needed to trigger dependencies
let metronomeState = $state.raw<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
	isPlaying: false
})

// Local audio playback state (may differ from network state due to autoplay restrictions)
let hasUserInteracted = $state(false)

// Last state update timestamp
let lastStateUpdateTimestamp = $state<number | null>(null)

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const updateState = (partialState: PartialMetronomeState): void => {
	// Update the state only if there are actual changes
	metronomeState = deepMergeIfChanged(metronomeState, partialState)
	
	// Store the current time as the last update timestamp
	try {
		lastStateUpdateTimestamp = TimeSync.getSyncedTime()
	} catch (error) {
		lastStateUpdateTimestamp = Date.now()
	}
}

/**
 * Handler for remote state updates that include a timestamp
 */
const handleRemoteStateUpdate = (state: MetronomeState, timestamp?: number): void => {
	// If we have a timestamp, we need to adjust for network delay and time sync offset
	if (timestamp) {
		// Store the remote timestamp for audio synchronization
		lastStateUpdateTimestamp = timestamp
		
		// If the state includes isPlaying=true and we're currently not playing,
		// we need to calculate the correct start position based on the timestamp
		if (state.isPlaying && !metronomeState.isPlaying) {
			console.log(`Remote play command received with timestamp: ${new Date(timestamp).toISOString()}`)
		}
	}
	
	// Update the state
	updateState(state)
}

/**
 * Toggle the playing state of the metronome
 */
const togglePlayback = (firstLocalPlay: boolean = false): void => {
	metronomeState = {
		...metronomeState, isPlaying: !metronomeState.isPlaying || firstLocalPlay
	}
}
</script>

<!-- Pass state and event handlers to the UI component -->
<MetronomeUI
	state={metronomeState}
	hasUserInteracted={hasUserInteracted}
	onStateUpdate={updateState}
	onTogglePlayback={() => {
		togglePlayback(!hasUserInteracted)
		hasUserInteracted = true
	}}
/>

<!-- Network component for WebSocket connections (no UI) -->
<MetronomeNetwork
	state={metronomeState}
	onRemoteStateUpdate={handleRemoteStateUpdate}
/>

<!-- Audio engine component (no UI) -->
<MetronomeAudio
	state={metronomeState}
	hasUserInteracted={hasUserInteracted}
	lastStateUpdateTimestamp={lastStateUpdateTimestamp}
/>
