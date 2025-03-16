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
import MetronomeNetwork from "./MetronomeNetwork.svelte"

// State object that contains all state values
const metronomeState = $state<MetronomeState>({
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
	// Update the state properties
	if (partialState.bpm !== undefined) {
		metronomeState.bpm = partialState.bpm;
	}
	
	if (partialState.timeSignature) {
		if (partialState.timeSignature.beatsPerMeasure !== undefined) {
			metronomeState.timeSignature.beatsPerMeasure = partialState.timeSignature.beatsPerMeasure;
		}
		
		if (partialState.timeSignature.beatUnit !== undefined) {
			metronomeState.timeSignature.beatUnit = partialState.timeSignature.beatUnit;
		}
	}
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
	// Update local state to match remote state
	metronomeState.bpm = remoteState.bpm;
	metronomeState.timeSignature.beatsPerMeasure = remoteState.timeSignature.beatsPerMeasure;
	metronomeState.timeSignature.beatUnit = remoteState.timeSignature.beatUnit;
	
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
