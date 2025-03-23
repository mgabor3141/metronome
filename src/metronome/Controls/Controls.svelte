<script lang="ts">
import {
	getMetronomeState,
	setMetronomeStateLocal,
} from "../providers/MetronomeStateProvider.svelte"
import { getStatus } from "../providers/StatusProvider.svelte"
import { Play, Pause } from "@lucide/svelte"
import DebugInfo from "./DebugInfo.svelte"
import FollowerCount from "./FollowerCount.svelte"
import Title from "./Title.svelte"
import JoinInfo from "./JoinInfo.svelte"
import JoinModal from "./JoinModal.svelte"
import LeaveModal from "./LeaveModal.svelte"
import { getClock } from "../providers/ClockProvider.svelte"
// UI constants
const MIN_BPM = 40
const MAX_BPM = 240
const VALID_BEAT_UNITS = [2, 4, 8, 16]
const MAX_BEATS_PER_MEASURE = 12

const status = getStatus()
const metronomeState = getMetronomeState()
const clockState = getClock()
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

<div
	class={[
		"toast toast-top toast-center mx-auto transition-opacity duration-400",
		{ "opacity-0": !clockState.syncing },
	]}
>
	<div class="alert">
		<span class="loading loading-spinner loading-md"></span>
		<p>Synchronizing to reference clock</p>
	</div>
</div>
<div class="flex h-[100dvh] flex-col gap-8 p-6 sm:p-12">
	<div class="flex flex-1 flex-col items-center justify-end">
		<Title />
	</div>

	<div
		class="bg-base-200 mx-auto flex w-full max-w-md flex-col items-stretch gap-6 rounded-lg p-6"
	>
		<div class="flex items-center gap-2">
			<button
				class="btn btn-sm btn-neutral"
				onclick={() =>
					setMetronomeStateLocal(metronomeState, {
						bpm: metronomeState.bpm - 1,
					})}>-1</button
			>
			<button
				class="btn btn-sm btn-neutral"
				onclick={() =>
					setMetronomeStateLocal(metronomeState, {
						bpm: metronomeState.bpm - 5,
					})}>-5</button
			>

			<div
				class="mx-6 flex flex-1 items-baseline justify-center gap-2 text-left text-2xl font-bold"
			>
				<input
					type="number"
					min={MIN_BPM}
					max={MAX_BPM}
					value={metronomeState.bpm}
					oninput={handleBpmChange}
					class="input input-ghost bg-neutral w-12 min-w-0 [appearance:textfield] p-0 pl-1 text-left text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<label for="bpm-input">BPM</label>
			</div>
			<button
				class="btn btn-sm btn-neutral"
				onclick={() =>
					setMetronomeStateLocal(metronomeState, {
						bpm: metronomeState.bpm + 5,
					})}>+5</button
			>
			<button
				class="btn btn-sm btn-neutral"
				onclick={() =>
					setMetronomeStateLocal(metronomeState, {
						bpm: metronomeState.bpm + 1,
					})}>+1</button
			>
		</div>

		<input
			id="bpm-input"
			type="range"
			min={MIN_BPM}
			max={MAX_BPM}
			value={metronomeState.bpm}
			oninput={handleBpmChange}
			class="range range-accent w-full"
		/>

		<div class="flex flex-wrap items-end justify-between">
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
			<button
				class={[
					"btn flex items-center gap-2",
					{ "bg-base-300": isPlaying, "btn-neutral": !isPlaying },
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
					<Pause class="size-4" />
					Stop
				{:else}
					<Play class="size-4" />
					{status.hasUserInteracted || !metronomeState.isPlaying
						? "Start"
						: "Join"}
				{/if}
			</button>
		</div>
	</div>

	<!-- Bottom bar -->
	<div class="flex flex-1 flex-col items-stretch justify-end gap-8">
		<JoinInfo />
		<div class="flex justify-center">
			<div class="flex flex-1 items-center">
				<FollowerCount />
			</div>

			<div class="flex gap-2">
				<JoinModal />
				<LeaveModal />
			</div>

			<div class="flex flex-1 justify-end">
				<DebugInfo />
			</div>
		</div>
	</div>
</div>
