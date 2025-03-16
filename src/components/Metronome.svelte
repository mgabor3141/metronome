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

// State object that contains all state values
let metronomeState = $state.raw<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
})

// Playback state
interface PlaybackState {
	isPlaying: boolean
}
const playbackState = $state<PlaybackState>({
	isPlaying: false,
})

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const updateState = (partialState: PartialMetronomeState): void => {
	// Update the state only if there are actual changes
	metronomeState = deepMergeIfChanged(metronomeState, partialState)
}

/**
 * Toggle the playing state of the metronome
 */
const togglePlayback = (): void => {
	playbackState.isPlaying = !playbackState.isPlaying;
}

/**
 * Handle remote state updates from other clients via WebSocket
 */
const handleRemoteStateUpdate = (remoteState: MetronomeState, isPlaying: boolean): void => {
	// Update local state to match remote state, only if there are changes
	metronomeState = deepMergeIfChanged(metronomeState, remoteState)
	
	// Update playback state
	playbackState.isPlaying = isPlaying;
}
</script>

<!-- Pass state and event handlers to the UI component -->
<MetronomeUI
	state={metronomeState}
	isPlaying={playbackState.isPlaying}
	onStateUpdate={updateState}
	onTogglePlayback={togglePlayback}
/>

<!-- Audio engine component (no UI) -->
<MetronomeAudio 
	state={metronomeState}
	isPlaying={playbackState.isPlaying}
/>

<!-- Network component for WebSocket connections (no UI) -->
<MetronomeNetwork
	state={metronomeState}
	isPlaying={playbackState.isPlaying}
	onRemoteStateUpdate={handleRemoteStateUpdate}
/>
