<script lang="ts">
import {
	getMetronomeState,
	setMetronomeStateLocal,
} from "../providers/MetronomeStateProvider.svelte"
import { getStatus } from "../providers/StatusProvider.svelte"

// UI constants
const MIN_BPM = 40
const MAX_BPM = 240
const VALID_BEAT_UNITS = [2, 4, 8, 16]
const MAX_BEATS_PER_MEASURE = 12

const status = getStatus()
const metronomeState = getMetronomeState()

const isPlaying = $derived(metronomeState.isPlaying && status.hasUserInteracted)

// UI-specific derived values
const beatDurationMs = $derived(60000 / metronomeState.bpm)

// Specific handlers for each input type
const handleBpmChange = (event: Event): void => {
	const target = event.target as HTMLInputElement
	const value = Number.parseInt(target.value, 10)

	if (value >= MIN_BPM && value <= MAX_BPM) {
		setMetronomeStateLocal(metronomeState, {
			bpm: value,
		})
	}
}

const handleBeatsPerMeasureChange = (event: Event): void => {
	const target = event.target as HTMLSelectElement
	const value = Number.parseInt(target.value, 10)

	if (value >= 1 && value <= MAX_BEATS_PER_MEASURE) {
		setMetronomeStateLocal(metronomeState, {
			timeSignature: {
				...metronomeState.timeSignature,
				beatsPerMeasure: value,
			},
		})
	}
}

const handleBeatUnitChange = (event: Event): void => {
	const target = event.target as HTMLSelectElement
	const value = Number.parseInt(target.value, 10)

	if (VALID_BEAT_UNITS.includes(value)) {
		setMetronomeStateLocal(metronomeState, {
			timeSignature: { ...metronomeState.timeSignature, beatUnit: value },
		})
	}
}
</script>

<div class="metronome-container mx-auto max-w-lg rounded-lg p-6 shadow-md">
	<h1 class="mb-4 text-center text-2xl font-bold">Metronome</h1>

	<div class="current-settings mb-6 rounded-md p-4">
		<div class="mb-2 text-center text-4xl font-bold">
			{metronomeState.bpm} BPM
		</div>
		<div class="text-center text-xl">
			{metronomeState.timeSignature.beatsPerMeasure}/{metronomeState
				.timeSignature.beatUnit}
		</div>
		<div class="mt-1 text-center text-sm text-gray-500">
			Beat duration: {beatDurationMs.toFixed(2)}ms
		</div>
	</div>

	<!-- Settings Subcomponent -->
	<div class="settings-panel">
		<h2 class="mb-3 text-lg font-semibold">Settings</h2>

		<div class="mb-4">
			<label for="bpm-input" class="mb-1 block text-sm font-medium">
				Tempo (BPM)
			</label>
			<div class="flex items-center gap-3">
				<input
					id="bpm-input"
					type="range"
					min={MIN_BPM}
					max={MAX_BPM}
					value={metronomeState.bpm}
					oninput={handleBpmChange}
					class="flex-grow"
				/>
				<input
					type="number"
					min={MIN_BPM}
					max={MAX_BPM}
					value={metronomeState.bpm}
					oninput={handleBpmChange}
					class="w-16 rounded border p-1 text-center"
				/>
			</div>
		</div>

		<div class="time-signature-settings">
			<label for="beats-per-measure" class="mb-1 block text-sm font-medium">
				Time Signature
			</label>
			<div class="flex items-center gap-2">
				<select
					id="beats-per-measure"
					value={metronomeState.timeSignature.beatsPerMeasure}
					onchange={handleBeatsPerMeasureChange}
					class="rounded border p-1"
				>
					{#each Array.from({ length: MAX_BEATS_PER_MEASURE }, (_, i) => i + 1) as beats (beats)}
						<option value={beats}>{beats}</option>
					{/each}
				</select>
				<span class="text-xl">/</span>
				<select
					id="beat-unit"
					value={metronomeState.timeSignature.beatUnit}
					onchange={handleBeatUnitChange}
					class="rounded border p-1"
				>
					{#each VALID_BEAT_UNITS as unit (unit)}
						<option value={unit}>{unit}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Playback Controls -->
	<div class="mt-6 flex flex-col items-center">
		<button
			class="btn"
			onclick={() => {
				const wasPlaying = isPlaying
				status.hasUserInteracted = true
				setMetronomeStateLocal(metronomeState, {
					isPlaying: !wasPlaying,
				})
			}}
		>
			{#if isPlaying}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<rect x="6" y="4" width="3" height="12" rx="1" />
					<rect x="11" y="4" width="3" height="12" rx="1" />
				</svg>
				Pause
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					viewBox="0 0 20 20"
					fill="currentColor"
				>
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
						clip-rule="evenodd"
					/>
				</svg>
				{status.hasUserInteracted || !metronomeState.isPlaying
					? "Start"
					: "Join"}
			{/if}
		</button>
	</div>
</div>
