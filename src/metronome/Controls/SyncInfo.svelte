<script lang="ts">
import { Clock } from "@lucide/svelte"
import { getClock } from "../providers/ClockProvider.svelte"
import { getGroup } from "../providers/GroupProvider.svelte"

const clock = getClock()
const groupState = getGroup()

const setManualOffset = (offset: number) => {
	clock.manualOffset = offset
}

const handleManualOffsetChange = (e: Event) => {
	if (e.target instanceof HTMLInputElement) {
		setManualOffset(Number(e.target.value))
	}
}

let modal: HTMLDialogElement
</script>

<button
	class="btn btn-sm btn-neutral min-w-32"
	onclick={() => modal.showModal()}
>
	{#if clock.syncing}
		<span class="loading loading-spinner loading-sm"></span> Syncing...
	{:else}
		<Clock class="size-4" /> Timing Info
	{/if}
</button>
{#if clock.manualOffset !== 0}
	<span class="text-neutral-content text-sm"
		>Manual offset: {clock.manualOffset.toFixed(0)}ms</span
	>
{/if}
<dialog bind:this={modal} class="modal">
	<div class="modal-box bg-base-200">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
				>✕</button
			>
		</form>
		<div class="flex flex-col items-center justify-center gap-4 text-center">
			{#if groupState.isGroupLeader}
				<h2 class="text-xl font-bold">Reference Clock</h2>
				<p class="py-2">
					This device plays a metronome with accurate timing that other devices
					will periodically synchronize to.
				</p>
			{:else}
				<h2 class="text-xl font-bold">Following Reference Clock</h2>
				<p class="py-2">
					This device will periodically adjust playback to match the reference
					clock.
				</p>
				<p>
					Your clock is offset by <span class="font-bold"
						>{clock.syncOffset.toFixed(2)}ms</span
					> relative to the reference clock
				</p>
			{/if}
			<h3 class="text-lg font-bold">Manual Offset</h3>
			<p>
				You can correct for differences due to eg. audio playback latency by
				setting a manual offset. Generally less than 100ms is needed.
			</p>
			<div class="flex w-full items-center gap-2">
				<button
					class="btn btn-sm btn-neutral"
					onclick={() => setManualOffset(clock.manualOffset - 1)}>-1</button
				>
				<button
					class="btn btn-sm btn-neutral"
					onclick={() => setManualOffset(clock.manualOffset - 5)}>-5</button
				>

				<div
					class="flex flex-1 flex-wrap items-baseline justify-center gap-2 text-left text-2xl font-bold"
				>
					<input
						type="number"
						id="manual-offset"
						value={clock.manualOffset}
						oninput={handleManualOffsetChange}
						class="input input-ghost bg-neutral w-16 min-w-0 [appearance:textfield] p-0 pl-2 text-left text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					/>
					<label for="manual-offset">ms</label>
				</div>
				<button
					class="btn btn-sm btn-neutral"
					onclick={() => setManualOffset(clock.manualOffset + 5)}>+5</button
				>
				<button
					class="btn btn-sm btn-neutral"
					onclick={() => setManualOffset(clock.manualOffset + 1)}>+1</button
				>
			</div>
			<button class="btn btn-neutral" onclick={() => setManualOffset(0)}
				>Reset</button
			>
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
