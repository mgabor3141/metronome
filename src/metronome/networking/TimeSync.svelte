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
		repeat: 8,
		interval: 30_000,
	})

	ts.send = async (id: string, data: unknown) => {
		send(peer.instance, data, id)
	}

	ts.on("sync", (state: unknown) => {
		console.debug(`Time sync ${state as "start" | "end"}`)
	})

	ts.on("change", (offsetValue: unknown) => {
		const newOffset = offsetValue as number
		timingState.offset = newOffset
		console.log(`Wall clock offset changed: ${newOffset}ms`)
	})

	peer.subscribe("timesync", (from, data) => {
		ts?.receive(from, data)
	})
})

onDestroy(() => {
	ts?.destroy()
})

let currentTime = $state(new Date())
let currentGlobalTime = $state(new Date())
let currentOtherGlobalTime = $state(new Date())

setInterval(() => {
	currentTime = new Date()
	currentGlobalTime = new Date(ts?.now() ?? 0)
	currentOtherGlobalTime = new Date(new Date().getTime() + timingState.offset)
}, 100)

$effect(() => {
	if (!ts) throw new Error("Timesync not initialized")

	if (groupState.isGroupLeader) {
		// No sync needed
		ts.options.peers = []
		timingState.offset = 0
		return
	}

	ts.options.peers = [groupState.leader]
})
</script>

<div class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	<p>Current time: {currentTime.toLocaleString()}</p>
	<p>Current time: {currentGlobalTime.toLocaleString()}</p>
	<p>Current time: {currentOtherGlobalTime.toLocaleString()}</p>
	<p>Time offset: {timingState.offset}ms</p>
	<button onclick={() => ts?.sync()}>Sync Now</button>
</div>
