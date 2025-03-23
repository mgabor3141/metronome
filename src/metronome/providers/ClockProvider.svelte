<script lang="ts" module>
import { getContext, setContext } from "svelte"

export const CLOCK_CONTEXT_KEY = Symbol("clock")

export type ClockState = {
	offset: number
	synced: boolean
	syncing: boolean
	now: () => number
}

export const getClock = () => getContext<ClockState>(CLOCK_CONTEXT_KEY)
</script>

<script lang="ts">
import * as timesync from "timesync"
import type { TimeSyncInstance } from "timesync"
import { onDestroy, onMount } from "svelte"
import { getGroup } from "./GroupProvider.svelte"
import { getPeerContext, type PeerDataCallback } from "./PeerProvider.svelte"
import {
	type P2PMessage,
	getPeerConnections,
	send,
} from "./PeerConnectionsProvider.svelte"
import { getStatus } from "./StatusProvider.svelte"

const status = getStatus()
const peer = getPeerContext()
const groupState = getGroup()
const peerConnections = getPeerConnections()

let ts: TimeSyncInstance | undefined

const clockState = $state<ClockState>({
	offset: 0,
	synced: false,
	syncing: false,
	now: () => {
		if (!ts) throw new Error("Timesync not initialized")
		return ts.now()
	},
})

setContext(CLOCK_CONTEXT_KEY, clockState)

let syncInterval = $state<Timer>()
let handler: PeerDataCallback<unknown>

onMount(() => {
	ts = timesync.create({
		peers: [],
		repeat: 8,
		interval: null,
		now: () => performance.timeOrigin + performance.now(),
	})

	ts.send = async (id: string, data: unknown) => {
		send(peer.instance, data as P2PMessage<unknown>, id)
	}

	ts.on("sync", (state: unknown) => {
		console.debug(`[TIME] Sync ${state as "start" | "end"}`)
		clockState.syncing = state === "start"
	})

	ts.on("change", (offsetValue: unknown) => {
		const newOffset = offsetValue as number
		console.log(`[TIME] Wall clock offset changed: ${newOffset.toFixed(4)}ms`)
		clockState.synced = true
		clockState.offset = newOffset
	})

	ts.on("error", (error: unknown) => {
		console.error("[TIME] Timesync error:", error)
	})

	handler = (_, from, data) => {
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

	if (groupState.isGroupLeader) {
		// Leader syncs with noone
		ts.options.peers = []
		clockState.synced = true
		return
	}

	ts.options.peers = [groupState.leader]

	const sync = () => {
		if (!ts) throw new Error("Timesync not initialized")
		if (!status.connected || !peerConnections.live) {
			console.log("[TIME] Not connected or peer not live, skipping sync")
			return
		}
		ts.sync()
	}

	if (!syncInterval && status.connected && peerConnections.live) {
		sync()
		syncInterval = setInterval(() => {
			sync()
		}, 30_000)
	}
})

const { children } = $props()
</script>

{@render children()}
