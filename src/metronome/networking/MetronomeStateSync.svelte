<script lang="ts">
import { onMount } from "svelte"
import type { MetronomeState } from "../Metronome.svelte"
import { broadcast } from "./providers/PeerConnectionsProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import { deepEqual } from "../../utils/object-utils"

let { metronomeState = $bindable() }: { metronomeState: MetronomeState } =
	$props()

const peer = getPeer()

let lastKnownState = $state<MetronomeState | undefined>()

onMount(() => {
	peer.subscribe("metronomeState", (_, data) => {
		lastKnownState = (data as { state: MetronomeState }).state
		metronomeState = lastKnownState
	})
})

$effect(() => {
	if (
		metronomeState.referenceTime &&
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

<div class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
    <pre class="text-left w-fit mx-auto">Metronome state: {JSON.stringify(metronomeState, null, 2)}</pre>
</div>
