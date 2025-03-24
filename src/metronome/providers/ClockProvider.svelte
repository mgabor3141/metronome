<script lang="ts" module>
import { getContext, setContext } from "svelte"
import { type PeerContext } from "./PeerProvider.svelte"

import { PersistedState } from "runed"

export const CLOCK_CONTEXT_KEY = Symbol("clock")

export const getClock = () => getContext<Clock>(CLOCK_CONTEXT_KEY)

export class Clock {
	syncOffset = $state(0)
	#manualOffset = new PersistedState("manual-offset", 0)
	get manualOffset() {
		return this.#manualOffset.current
	}
	set manualOffset(value: number) {
		this.#manualOffset.current = value
	}
	offset = $derived(this.syncOffset + this.manualOffset)
	synced = $state(false)
	syncing = $state(false)

	ts: TimeSyncInstance = timesync.create({
		peers: [],
		repeat: 8,
		interval: null,
		now: () => performance.timeOrigin + performance.now(),
	})
	peer: PeerContext

	now(): number {
		if (!this.ts) console.warn("[TIME] Timesync not initialized")
		return this.ts.now() + this.manualOffset
	}

	constructor(peer: PeerContext) {
		this.peer = peer
		this.ts.send = async (id: string, data: unknown) => {
			send(peer.instance, data as P2PMessage<unknown>, id)
		}

		this.ts.on("sync", (state: unknown) => {
			console.debug(`[TIME] Sync ${state as "start" | "end"}`)
			this.syncing = state === "start"
		})

		this.ts.on("change", (offsetValue: unknown) => {
			const newOffset = offsetValue as number
			console.log(`[TIME] Wall clock offset changed: ${newOffset.toFixed(4)}ms`)
			this.synced = true
			this.syncOffset = newOffset
		})

		this.ts.on("error", (error: unknown) => {
			console.error("[TIME] Timesync error:", error)
		})

		peer.subscribe("timesync", this.handler)
	}

	handler: PeerDataCallback<unknown> = (_, from, data) => {
		this.ts.receive(from, data)
	}

	unsubscribe() {
		this.peer.unsubscribe("timesync", this.handler)
	}
}
</script>

<script lang="ts">
import * as timesync from "timesync"
import type { TimeSyncInstance } from "timesync"
import { onDestroy } from "svelte"
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

const clock = new Clock(peer)

setContext(CLOCK_CONTEXT_KEY, clock)

let syncInterval = $state<Timer>()

onDestroy(() => {
	clock.ts.destroy()
	clock.unsubscribe()
	clearInterval(syncInterval)
	syncInterval = undefined
})

$effect(() => {
	if (!clock.ts) throw new Error("Timesync not initialized")

	if (groupState.isGroupLeader) {
		// Leader syncs with noone
		clock.ts.options.peers = []
		clock.synced = true
		return
	}

	clock.ts.options.peers = [groupState.leader]

	const sync = () => {
		if (!clock.ts) throw new Error("Timesync not initialized")
		if (!status.connected || !peerConnections.live) {
			console.log("[TIME] Not connected or peer not live, skipping sync")
			return
		}
		clock.ts.sync()
	}

	if (!syncInterval && status.connected && peerConnections.live) {
		sync()
		syncInterval = setInterval(() => {
			sync()
		}, 60_000)
	}
})

const { children } = $props()
</script>

{@render children()}
