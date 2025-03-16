<script lang="ts" module>
/**
 * Interface for the metronome state
 */
export interface MetronomeState {
	bpm: number
	timeSignature: {
		beatsPerMeasure: number
		beatUnit: number
	}
}

/**
 * Type for partial state updates
 */
export type PartialMetronomeState = {
	bpm?: number
	timeSignature?: Partial<MetronomeState["timeSignature"]>
}
</script>

<script lang="ts">
/**
 * Metronome component that manages tempo and time signature
 * This component owns the state and delegates UI rendering to MetronomeUI
 */
import MetronomeUI from "./MetronomeUI.svelte"

// Encapsulate all state in a single object
const state = $state<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
})

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const updateState = (partialState: PartialMetronomeState): void => {
	// Update top-level properties
	if (partialState.bpm !== undefined) {
		state.bpm = partialState.bpm
	}
	
	// Update nested timeSignature properties
	if (partialState.timeSignature) {
		const { beatsPerMeasure, beatUnit } = partialState.timeSignature
		
		if (beatsPerMeasure !== undefined) {
			state.timeSignature.beatsPerMeasure = beatsPerMeasure
		}
		
		if (beatUnit !== undefined) {
			state.timeSignature.beatUnit = beatUnit
		}
	}
}
</script>

<!-- Pass state and event handlers to the UI component -->
<MetronomeUI
	state={state}
	onStateUpdate={updateState}
/>
