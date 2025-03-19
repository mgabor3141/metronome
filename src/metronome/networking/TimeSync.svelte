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
		now: () => performance.timeOrigin + performance.now(),
	})

	timingState.offset = ts.offset

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
		// Leader syncs with noone
		// Note that in case of leader migration the previous offset remains in ts internally and our state
		ts.options.peers = []
		return
	}

	ts.options.peers = [groupState.leader]
})
</script>

<div class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center font-mono">
	<p>Local time:- {currentTime.toLocaleString()}</p>
	<p>ts.now time: {currentGlobalTime.toLocaleString()}</p>
	<p>Offset time: {currentOtherGlobalTime.toLocaleString()}</p>
	<p>Time offset: {timingState.offset}ms</p>
	<button class="cursor-pointer text-gray-500 dark:text-gray-400 text-sm inline-block border active:scale-95" onclick={() => ts?.sync()}>Sync Now</button>
</div>
