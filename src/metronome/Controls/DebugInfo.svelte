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
</script>

<button class="btn btn-sm" onclick={() => modal.showModal()}>
	<Braces class="h-4 w-4" />
</button>
<dialog bind:this={modal} class="modal">
	<div class="modal-box">
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
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
				>✕</button
			>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
