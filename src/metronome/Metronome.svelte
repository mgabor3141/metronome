<!-- @hmr:keep-all -->
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

	/**
	 * Time of the "one" beat of the current measure
	 * Undefined until the local playback actually picks up the update
	 */
	referenceTime: number | undefined
}

export type TimingState = {
	offset: number
	ready: boolean
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
import { deepMergeIfChanged } from "../utils/object-utils";
import Audio from "./Audio.svelte";
import Controls from "./Controls/Controls.svelte";
import Networking from "./networking/Networking.svelte";

let metronomeState = $state<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
	isPlaying: false,
	referenceTime: undefined,
})

let waitingForInitialState = $state(true)

let timingState = $state<TimingState>({
	offset: 0,
	ready: false,
})

// Local audio playback state (may differ from network state due to autoplay restrictions)
let hasUserInteracted = $state(false)

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const localStateUpdate = (partialState: PartialMetronomeState): void => {
	// Update the state only if there are actual changes
	metronomeState = deepMergeIfChanged(metronomeState, partialState)
	metronomeState.referenceTime = undefined
}

/**
 * Toggle the playing state of the metronome
 */
const togglePlayback = (firstLocalPlay: boolean = false): void => {
	if (firstLocalPlay && metronomeState.isPlaying) {
		// We align with the already playing reference time (not going through localStateUpdate)
		metronomeState.isPlaying = true
	} else {
		localStateUpdate({
			isPlaying: !metronomeState.isPlaying,
		})
	}
}
</script>

<Controls
	{metronomeState}
	{hasUserInteracted}
	timingReady={timingState.ready}
	initialStateReady={!waitingForInitialState}
	onStateUpdate={localStateUpdate}
	onTogglePlayback={() => {
		togglePlayback(!hasUserInteracted)
		hasUserInteracted = true
	}}
/>

<Networking bind:metronomeState bind:timingState bind:waitingForInitialState />

<Audio
	bind:metronomeState
	{hasUserInteracted}
	{timingState}
/>
