<script lang="ts">
import DebugString from "../../components/DebugString.svelte"
import { Braces } from "@lucide/svelte"

import { getMetronomeState } from "../providers/MetronomeStateProvider.svelte"
import { getClock } from "../providers/ClockProvider.svelte"
import { getGroup } from "../providers/GroupProvider.svelte"
import { getPeerConnections } from "../providers/PeerConnectionsProvider.svelte"
import { getPeerContext } from "../providers/PeerProvider.svelte"
import { getStatus } from "../providers/StatusProvider.svelte"

const metronomeState = getMetronomeState()
const clockState = getClock()
const groupState = getGroup()
const peerConnections = getPeerConnections()
const peerContext = getPeerContext()
const status = getStatus()

let modal: HTMLDialogElement

const clock = getClock()
let updateTimeDisplay = $state(false)

const setModalOpen = (open: boolean) => {
	updateTimeDisplay = open
	if (open) {
		modal.showModal()
	} else {
		modal.close()
	}
}

let now = $state(clock.now())
const updateClock = () => {
	now = clock.now()
	if (!updateTimeDisplay) return
	requestAnimationFrame(updateClock)
}

$effect(() => {
	if (!updateTimeDisplay) return
	const id = requestAnimationFrame(updateClock)
	return () => cancelAnimationFrame(id)
})
</script>

<button class="btn btn-sm btn-ghost" onclick={() => setModalOpen(true)}>
	<Braces class="size-4" />
</button>
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
		<h2 class="text-xl font-bold">Debug Info</h2>
		<p>
			{#if clockState.synced}Synced t{:else}T{/if}ime:
			<code>{now} (Δ{clockState.offset.toFixed(6)}ms)</code>
		</p>
		<DebugString
			status={{
				peerConnected: status.peerConnected,
				serverConnected: status.serverConnected,
				hasUserInteracted: status.hasUserInteracted,
			}}
			{groupState}
			peer={{
				id: peerContext.id,
				openConnections: peerContext.availableConnections,
				allConnected: peerConnections.live,
			}}
			{clockState}
			{metronomeState}
		/>
		<form method="dialog">
			<button
				class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
				onclick={() => setModalOpen(false)}>✕</button
			>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button onclick={() => setModalOpen(false)}>close</button>
	</form>
</dialog>
