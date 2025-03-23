<script lang="ts">
import { onDestroy } from "svelte"
import { broadcast } from "./providers/PeerConnectionsProvider.svelte"
import {
	getPeerContext,
	type PeerDataCallback,
} from "./providers/PeerProvider.svelte"
import { deepEqual } from "../utils/object-utils"
import {
	getMetronomeState,
	type MetronomeState,
} from "./providers/MetronomeStateProvider.svelte"
import { getStatus } from "./providers/StatusProvider.svelte"

const status = getStatus()
const peer = getPeerContext()
const metronomeState = getMetronomeState()

let lastKnownState = { ...metronomeState }

const stateHandler: PeerDataCallback<unknown> = (_peer, _from, data) => {
	Object.assign(metronomeState, (data as { state: MetronomeState }).state)
	lastKnownState = { ...metronomeState }
}

$effect(() => {
	if (!status.connected) return
	peer.subscribe("metronomeState", stateHandler)
})

onDestroy(() => {
	peer.unsubscribe("metronomeState", stateHandler)
})

$effect(() => {
	if (
		// We send the update if there is already an assigned reference time or if it's a stop state
		(metronomeState.referenceTime || metronomeState.isPlaying === false) &&
		// ...and it's different from the last known state
		!deepEqual(metronomeState, lastKnownState) &&
		// ...and we are connected
		status.connected
	) {
		lastKnownState = { ...metronomeState }
		broadcast(peer.instance, {
			method: "metronomeState",
			state: metronomeState,
		})
	}
})
</script>
