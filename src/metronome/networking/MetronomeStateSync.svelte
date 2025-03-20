<script lang="ts">
import { onDestroy, onMount } from "svelte"
import type { MetronomeState } from "../Metronome.svelte"
import { broadcast } from "./providers/PeerConnectionsProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import { deepEqual } from "../../utils/object-utils"
import DebugString from "../../components/DebugString.svelte"

let {
	metronomeState = $bindable(),
	waitingForInitialState = $bindable(),
}: { metronomeState: MetronomeState; waitingForInitialState: boolean } =
	$props()

const peer = getPeer()

let lastKnownState = $state<MetronomeState | undefined>()

const stateHandler = (_from: string, data: unknown) => {
	lastKnownState = (data as { state: MetronomeState }).state
	metronomeState = lastKnownState
	waitingForInitialState = false
}

onMount(() => {
	peer.subscribe("metronomeState", stateHandler)
})

onDestroy(() => {
	peer.unsubscribe("metronomeState", stateHandler)
})

$effect(() => {
	if (
		(metronomeState.referenceTime || metronomeState.isPlaying === false) &&
		!deepEqual(metronomeState, lastKnownState)
	) {
		lastKnownState = metronomeState
		broadcast(peer.instance, {
			method: "metronomeState",
			state: metronomeState,
		})
	}
})
</script>

<DebugString {metronomeState} {waitingForInitialState} />
