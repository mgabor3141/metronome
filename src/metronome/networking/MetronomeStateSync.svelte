<script lang="ts">
import { onMount } from "svelte"
import type { MetronomeState, TimingState } from "../Metronome.svelte"
import { broadcast } from "./providers/PeerConnectionsProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import * as Tone from "tone"
import { calculateReferenceTime } from "../../utils/timing-utils"
import { deepEqual } from "../../utils/object-utils"

let {
	metronomeState = $bindable(),
	timingState,
}: { metronomeState: MetronomeState; timingState: TimingState } = $props()

const peer = getPeer()

let lastKnownState = $state<MetronomeState | undefined>(undefined)

onMount(() => {
	peer.subscribe("metronomeState", (from, data) => {
		lastKnownState = (data as { state: MetronomeState }).state
		metronomeState = lastKnownState
	})
})

$effect(() => {
	if (!deepEqual(metronomeState, lastKnownState)) {
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
