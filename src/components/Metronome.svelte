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
	referenceTime: number
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
import MetronomeUI from "./MetronomeUI.svelte"
import MetronomeAudio from "./MetronomeAudio.svelte"
import { deepMergeIfChanged } from "../utils/object-utils"
import { calculateReferenceTime } from "../utils/timing-utils"
import Networking from "../networking/Networking.svelte";
import * as Tone from "tone";

// Raw state needed to trigger dependencies
let metronomeState = $state.raw<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
	isPlaying: false,

	/**
	 * Time of the "one" beat of the current measure
	*/
	referenceTime: Date.now()
})

let timingState = $state<TimingState>({
	offset: 0
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
		if (hasUserInteracted) {
			const playhead = Tone.getTransport().immediate()
			newState.referenceTime = calculateReferenceTime(
				playhead,
				newState.bpm, 
				newState.timeSignature.beatsPerMeasure
			)
			console.log("newState.referenceTime", newState.referenceTime)
		}

		metronomeState = newState
	}
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
	{metronomeState}
	{hasUserInteracted}
	onStateUpdate={updateState}
	onTogglePlayback={() => {
		togglePlayback(!hasUserInteracted)
		hasUserInteracted = true
	}}
/>

<Networking bind:metronomeState bind:timingState />

<!-- Audio engine component -->
<MetronomeAudio
	{metronomeState}
	{hasUserInteracted}
	{timingState}
/>
