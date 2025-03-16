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
import MetronomeAudio from "./MetronomeAudio.svelte"

// State object that contains all state values
let metronomeState = $state.raw<MetronomeState>({
	bpm: 120,
	timeSignature: {
		beatsPerMeasure: 4,
		beatUnit: 4,
	},
})

// Playing state
const playbackState = $state({
	isPlaying: false
})

/**
 * Single handler for all state updates
 * Takes a partial state object and merges it with the current state
 */
const updateState = (partialState: PartialMetronomeState): void => {
	metronomeState = {
		...metronomeState,
		...partialState,
		timeSignature: {
			...metronomeState.timeSignature,
			...partialState.timeSignature,
		},
	}
}

/**
 * Toggle the playing state of the metronome
 */
const togglePlayback = (): void => {
	playbackState.isPlaying = !playbackState.isPlaying
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
