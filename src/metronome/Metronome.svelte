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
import { deepMergeIfChanged } from "../utils/object-utils"
import { getReferenceTime } from "../utils/timing-utils"
import * as Tone from "tone"
import Audio from "./Audio.svelte"
import Controls from "./Controls/Controls.svelte"
import Networking from "./networking/Networking.svelte"

// Raw state needed to trigger dependencies
let metronomeState = $state.raw<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
	isPlaying: false,
	referenceTime: undefined,
})

let timingState = $state<TimingState>({
	offset: 0,
})

// Local audio playback state (may differ from network state due to autoplay restrictions)
let hasUserInteracted = $state(false)

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const updateState = (partialState: PartialMetronomeState): void => {
	// Update the state only if there are actual changes
	const newState = deepMergeIfChanged(metronomeState, partialState)
	if (newState !== metronomeState) {
		newState.referenceTime = undefined
		metronomeState = newState
	}
}

/**
 * Toggle the playing state of the metronome
 */
const togglePlayback = (firstLocalPlay: boolean = false): void => {
	updateState({
		isPlaying: !metronomeState.isPlaying || firstLocalPlay,
	})
}
</script>

<Controls
	{metronomeState}
	{hasUserInteracted}
	onStateUpdate={updateState}
	onTogglePlayback={() => {
		togglePlayback(!hasUserInteracted)
		hasUserInteracted = true
	}}
/>

<Networking bind:metronomeState bind:timingState />

<Audio
	bind:metronomeState
	{hasUserInteracted}
	{timingState}
/>
