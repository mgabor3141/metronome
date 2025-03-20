<!-- @hmr:keep-all -->
<script lang="ts">
import { onDestroy, onMount } from "svelte"
import { broadcast } from "./providers/PeerConnectionsProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import { deepEqual } from "../utils/object-utils"
import {
	getMetronomeState,
	type MetronomeState,
} from "./providers/MetronomeStateProvider.svelte"

const peer = getPeer()
const metronomeState = getMetronomeState()

const lastKnownState = $state<MetronomeState>({ ...metronomeState })

const stateHandler = (_from: string, data: unknown) => {
	Object.assign(metronomeState, (data as { state: MetronomeState }).state)
	Object.assign(lastKnownState, metronomeState)
}

onMount(() => {
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
		!deepEqual(metronomeState, lastKnownState)
	) {
		Object.assign(lastKnownState, metronomeState)
		broadcast(peer.instance, {
			method: "metronomeState",
			state: metronomeState,
		})
	}
})
</script>
