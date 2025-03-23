<script lang="ts">
import NumberFlow from "@number-flow/svelte"
import { getGroup } from "../providers/GroupProvider.svelte"
import { CircleHelp } from "@lucide/svelte"

const groupState = getGroup()
const connectedFollowers = $derived(groupState.members.length - 1)

let modal: HTMLDialogElement
</script>

<div class="prose">
	<h1 class="font-title text-center text-4xl font-light tracking-tighter">
		Network Metronome
	</h1>

	<div
		class={[
			"flex items-center justify-center transition-opacity duration-1000",
			{ "opacity-0": connectedFollowers === 0 },
		]}
	>
		<button class="btn btn-ghost font-normal" onclick={() => modal.showModal()}>
			{#if groupState.isGroupLeader}
				This device is the reference clock
			{:else}
				This device is following the reference clock
			{/if}
			<CircleHelp class="ml-2 size-4" /></button
		>
		<dialog bind:this={modal} id="my_modal_2" class="modal">
			<div class="modal-box text-center">
				<form method="dialog">
					<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
						>✕</button
					>
				</form>
				{#if groupState.isGroupLeader}
					<h2 class="text-xl font-bold">Reference Clock</h2>
					<p class="py-4">
						This device plays a metronome with accurate timing that other
						devices will periodically synchronize to.
					</p>
				{:else}
					<h2 class="text-xl font-bold">Following Reference Clock</h2>
					<p class="py-4">
						This device will periodically update its metronome to match the
						reference clock.
					</p>
				{/if}
			</div>
			<form method="dialog" class="modal-backdrop">
				<button>close</button>
			</form>
		</dialog>
	</div>
</div>
