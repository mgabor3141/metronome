<script lang="ts">
/**
 * MetronomeUI component that handles the presentation layer for the metronome
 */
import type { MetronomeState, PartialMetronomeState } from "./Metronome.svelte"

// UI constants
const MIN_BPM = 40
const MAX_BPM = 240
const VALID_BEAT_UNITS = [2, 4, 8, 16]
const MAX_BEATS_PER_MEASURE = 12

// Props interface for the component
interface MetronomeUIProps {
	// Full state object
	state: MetronomeState
	// Playing state
	isPlaying: boolean
	// Single event handler for state updates
	onStateUpdate: (partialState: PartialMetronomeState) => void
	// Toggle playback handler
	onTogglePlayback: () => void
}

// Receive props from parent component
const props: MetronomeUIProps = $props()

// UI-specific derived values
const beatDurationMs = $derived(60000 / props.state.bpm)

// Specific handlers for each input type
const handleBpmChange = (event: Event): void => {
	const target = event.target as HTMLInputElement
	const value = Number.parseInt(target.value, 10)
	
	if (value >= MIN_BPM && value <= MAX_BPM) {
		props.onStateUpdate({ bpm: value })
	}
}

const handleBeatsPerMeasureChange = (event: Event): void => {
	const target = event.target as HTMLSelectElement
	const value = Number.parseInt(target.value, 10)
	
	if (value >= 1 && value <= MAX_BEATS_PER_MEASURE) {
		props.onStateUpdate({
			timeSignature: { beatsPerMeasure: value }
		})
	}
}

const handleBeatUnitChange = (event: Event): void => {
	const target = event.target as HTMLSelectElement
	const value = Number.parseInt(target.value, 10)
	
	if (VALID_BEAT_UNITS.includes(value)) {
		props.onStateUpdate({
			timeSignature: { beatUnit: value }
		})
	}
}
</script>

<div class="metronome-container p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md">
	<h1 class="text-2xl font-bold mb-4 text-center">Metronome</h1>

	<div class="current-settings mb-6 p-4 bg-gray-50 rounded-md">
		<div class="text-center text-4xl font-bold mb-2">{props.state.bpm} BPM</div>
		<div class="text-center text-xl">
			{props.state.timeSignature.beatsPerMeasure}/{props.state.timeSignature.beatUnit}
		</div>
		<div class="text-center text-sm text-gray-500 mt-1">
			Beat duration: {beatDurationMs.toFixed(2)}ms
		</div>
	</div>

	<!-- Settings Subcomponent -->
	<div class="settings-panel">
		<h2 class="text-lg font-semibold mb-3">Settings</h2>

		<div class="mb-4">
			<label for="bpm-input" class="block text-sm font-medium mb-1">
				Tempo (BPM)
			</label>
			<div class="flex items-center gap-3">
				<input
					id="bpm-input"
					type="range"
					min={MIN_BPM}
					max={MAX_BPM}
					value={props.state.bpm}
					oninput={handleBpmChange}
					class="flex-grow"
				/>
				<input
					type="number"
					min={MIN_BPM}
					max={MAX_BPM}
					value={props.state.bpm}
					oninput={handleBpmChange}
					class="w-16 p-1 border rounded text-center"
				/>
			</div>
		</div>

		<div class="time-signature-settings">
			<label for="beats-per-measure" class="block text-sm font-medium mb-1">
				Time Signature
			</label>
			<div class="flex items-center gap-2">
				<select
					id="beats-per-measure"
					value={props.state.timeSignature.beatsPerMeasure}
					onchange={handleBeatsPerMeasureChange}
					class="p-1 border rounded"
				>
					{#each Array.from({ length: MAX_BEATS_PER_MEASURE }, (_, i) => i + 1) as beats}
						<option value={beats}>{beats}</option>
					{/each}
				</select>
				<span class="text-xl">/</span>
				<select
					id="beat-unit"
					value={props.state.timeSignature.beatUnit}
					onchange={handleBeatUnitChange}
					class="p-1 border rounded"
				>
					{#each VALID_BEAT_UNITS as unit}
						<option value={unit}>{unit}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Playback Controls -->
	<div class="mt-6 flex justify-center">
		<button 
			class="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
			onclick={props.onTogglePlayback}
		>
			{#if props.isPlaying}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<rect x="6" y="4" width="3" height="12" rx="1" />
					<rect x="11" y="4" width="3" height="12" rx="1" />
				</svg>
				Pause
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
				</svg>
				Start
			{/if}
		</button>
	</div>
</div>

<style>
	/* Component-specific styles can be added here if needed */
	/* Most styling is handled by Tailwind CSS classes */
</style>
