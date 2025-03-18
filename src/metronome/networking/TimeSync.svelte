<script lang="ts">
import type { TimingState } from "../Metronome.svelte"
import * as timesync from "timesync"
import type { TimeSyncInstance } from "timesync"
import { onDestroy, onMount } from "svelte"
import { getGroup } from "./providers/GroupProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import { send } from "./providers/PeerConnectionsProvider.svelte"

const { timingState = $bindable() }: { timingState: TimingState } = $props()

const peer = getPeer()
const groupState = getGroup()
let ts: TimeSyncInstance | undefined

onMount(() => {
	ts = timesync.create({
		peers: [],
	})

	ts.send = async (id: string, data: unknown) => {
		send(peer.instance, data, id)
	}

	ts.on("sync", (state: unknown) => {
		console.log(`Time sync ${state as "start" | "end"}`)
	})

	ts.on("change", (offsetValue: unknown) => {
		const newOffset = offsetValue as number
		timingState.offset = newOffset
		console.log(`Time offset changed: ${newOffset}ms`)
	})

	peer.subscribe("timesync", (from, data) => {
		ts?.receive(from, data)
	})
})

onDestroy(() => {
	ts?.destroy()
})

$effect(() => {
	if (!ts) throw new Error("Timesync not initialized")

	if (groupState.isGroupLeader) {
		// No sync needed
		ts.options.peers = []
		return
	}

	ts.options.peers = groupState.members.filter((id) => id !== peer.id)
})
</script>

<div class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	<p>Time offset: {timingState.offset}ms</p>
</div>
