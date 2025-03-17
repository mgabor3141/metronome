<script lang="ts" module>
/**
 * Metronome component module script
 * Exports types used by other components
 */

// Time signature type
export interface TimeSignature {
	beatsPerMeasure: number
	beatUnit: number
}

// Metronome state type
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
 * Main Metronome component
 * Manages state and delegates UI rendering to child components
 */
import MetronomeUI from "./MetronomeUI.svelte"
import MetronomeAudio from "./MetronomeAudio.svelte"
import { deepMergeIfChanged } from "../utils/object-utils"
import Networking from "../networking/Networking.svelte";

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

<!-- Metronome Controls -->
<MetronomeUI
	state={metronomeState}
	hasUserInteracted={hasUserInteracted}
	onStateUpdate={updateState}
	onTogglePlayback={() => {
		togglePlayback(!hasUserInteracted)
		hasUserInteracted = true
	}}
/>

<Networking bind:metronomeState />

<!-- Audio engine component -->
<MetronomeAudio
	state={metronomeState}
	hasUserInteracted={hasUserInteracted}
/>
