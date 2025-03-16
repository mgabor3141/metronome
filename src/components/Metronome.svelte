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

<!-- Audio engine component (no UI) -->
<MetronomeAudio 
	state={metronomeState}
	hasUserInteracted={hasUserInteracted}
/>

<!-- Network component for WebSocket connections (no UI) -->
<MetronomeNetwork
	state={metronomeState}
	onRemoteStateUpdate={updateState}
/>
