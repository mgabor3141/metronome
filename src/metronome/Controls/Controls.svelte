<script lang="ts">
import {
	getMetronomeState,
	setMetronomeStateLocal,
} from "../providers/MetronomeStateProvider.svelte"
import { getStatus } from "../providers/StatusProvider.svelte"
import { Play, Pause, Braces } from "@lucide/svelte"

// UI constants
const MIN_BPM = 40
const MAX_BPM = 240
const VALID_BEAT_UNITS = [2, 4, 8, 16]
const MAX_BEATS_PER_MEASURE = 12

const status = getStatus()
const metronomeState = getMetronomeState()

const isPlaying = $derived(metronomeState.isPlaying && status.hasUserInteracted)

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

<div class="flex h-[100vh] flex-col gap-16 p-6 py-12 sm:p-12">
	<div class="flex flex-1 flex-col items-center justify-end">
		<h1 class="text-center text-4xl font-bold">Shared Metronome</h1>
	</div>

	<div
		class="bg-base-200 mx-auto flex w-full max-w-md flex-col items-stretch gap-6 rounded-lg p-6"
	>
		<div class="flex flex-wrap items-center justify-between">
			<div class="flex items-baseline gap-2 text-left text-2xl font-bold">
				<input
					type="number"
					min={MIN_BPM}
					max={MAX_BPM}
					value={metronomeState.bpm}
					oninput={handleBpmChange}
					class="input input-ghost w-12 min-w-0 p-0 text-left text-2xl"
				/>
				<label for="bpm-input">BPM</label>
			</div>

			<div class="time-signature-settings">
				<div class="flex items-center gap-2">
					<select
						id="beats-per-measure"
						value={metronomeState.timeSignature.beatsPerMeasure}
						onchange={handleBeatsPerMeasureChange}
						class="select w-16"
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
						class="select w-16"
					>
						{#each VALID_BEAT_UNITS as unit (unit)}
							<option value={unit}>{unit}</option>
						{/each}
					</select>
				</div>
			</div>
		</div>

		<input
			id="bpm-input"
			type="range"
			min={MIN_BPM}
			max={MAX_BPM}
			value={metronomeState.bpm}
			oninput={handleBpmChange}
			class="range w-full"
		/>

		<div class="flex items-center justify-center">
			<button
				class={[
					"btn btn-xl flex items-center gap-2",
					{ "bg-base-300": !isPlaying, "btn-neutral": isPlaying },
				]}
				onclick={() => {
					const wasPlaying = isPlaying
					status.hasUserInteracted = true
					setMetronomeStateLocal(metronomeState, {
						isPlaying: !wasPlaying,
					})
				}}
			>
				{#if isPlaying}
					<Pause class="h-4 w-4" />
					Stop
				{:else}
					<Play class="h-4 w-4" />
					{status.hasUserInteracted || !metronomeState.isPlaying
						? "Start"
						: "Join"}
				{/if}
			</button>
		</div>
	</div>

	<!-- Bottom bar -->
	<div class="flex flex-1 flex-col items-stretch justify-end">
		<div class="flex justify-center">
			<div class="flex-1"></div>
			<div>Join</div>
			<div class="flex flex-1 justify-end">
				<button class="btn btn-sm">
					<Braces class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>
</div>
