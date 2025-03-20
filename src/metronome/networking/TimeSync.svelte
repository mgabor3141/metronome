<script lang="ts">
import type { TimingState } from "../Metronome.svelte"
import * as timesync from "timesync"
import type { TimeSyncInstance } from "timesync"
import { onDestroy, onMount } from "svelte"
import { getGroup } from "./providers/GroupProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import {
	type P2PMessage,
	getPeerConnections,
	send,
} from "./providers/PeerConnectionsProvider.svelte"
import DebugString from "../../components/DebugString.svelte"

const { timingState = $bindable() }: { timingState: TimingState } = $props()

const peer = getPeer()
const groupState = getGroup()
const peerConnections = getPeerConnections()

let ts: TimeSyncInstance | undefined
let syncInterval = $state<Timer>()
let handler: (from: string, data: unknown) => void

onMount(() => {
	ts = timesync.create({
		peers: [],
		repeat: 8,
		interval: null,
		now: () => performance.timeOrigin + performance.now(),
	})

	timingState.offset = ts.offset

	ts.send = async (id: string, data: unknown) => {
		send(peer.instance, data as P2PMessage<unknown>, id)
	}

	ts.on("sync", (state: unknown) => {
		console.debug(`[TIME] Sync ${state as "start" | "end"}`)
	})

	ts.on("change", (offsetValue: unknown) => {
		const newOffset = offsetValue as number
		console.log(`[TIME] Wall clock offset changed: ${newOffset.toFixed(4)}ms`)
		timingState.offset = newOffset
		timingState.ready = true
	})

	ts.on("error", (error: unknown) => {
		console.error("[TIME] Timesync error:", error)
	})

	handler = (from, data) => {
		ts?.receive(from, data)
	}

	peer.subscribe("timesync", handler)
})

onDestroy(() => {
	ts?.destroy()
	peer.unsubscribe("timesync", handler)
	clearInterval(syncInterval)
	syncInterval = undefined
})

$effect(() => {
	if (!ts) throw new Error("Timesync not initialized")

	if (!peerConnections.live) {
		clearInterval(syncInterval)
		syncInterval = undefined
		return
	}

	if (groupState.isGroupLeader) {
		// Leader syncs with noone
		// Note that in case of leader migration the previous offset remains in ts internally and our state
		ts.options.peers = []
		timingState.ready = true
		return
	}

	ts.options.peers = [groupState.leader]

	if (!syncInterval) {
		ts.sync()
		syncInterval = setInterval(() => {
			ts?.sync()
		}, 30_000)
	}
})

let currentTime = $state(new Date())
let currentGlobalTime = $state(new Date())
let currentOtherGlobalTime = $state(new Date())

setInterval(() => {
	currentTime = new Date()
	currentGlobalTime = new Date(ts?.now() ?? 0)
	currentOtherGlobalTime = new Date(new Date().getTime() + timingState.offset)
}, 100)
</script>

<DebugString
	{timingState}
	localTime={currentTime}
	tsNowTime={currentGlobalTime}
	calTsTime={currentOtherGlobalTime}
>
	<button
		class="cursor-pointer rounded bg-gray-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
		onclick={() => ts?.sync()}>Sync Now</button
	>
</DebugString>
