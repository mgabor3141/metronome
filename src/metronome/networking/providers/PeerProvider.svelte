<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"

const PEER_CONTEXT_KEY = Symbol("peer")

export type P2PMessageType = "timesync" | "metronomeState"

export type PeerDataCallback<T> = (from: string, data: T) => void

export type PeerContext = {
	instance: Peer
	id: string
	subscribers: Record<P2PMessageType, PeerDataCallback<unknown>[]>
	setupConnectionListeners: (conn: DataConnection) => void
	subscribe: (
		method: P2PMessageType,
		callback: (from: string, data: unknown) => void,
	) => void
}

export const getPeer = () => {
	return getContext<PeerContext>(PEER_CONTEXT_KEY)
}
</script>

<script lang="ts">
import Peer from "peerjs"
import type { DataConnection } from "peerjs"

const subscribers = $state<Record<P2PMessageType, PeerDataCallback<unknown>[]>>(
	{
		timesync: [],
		metronomeState: [],
	},
)

const peer = $state<
	Omit<PeerContext, "instance" | "id"> & Partial<PeerContext>
>({
	subscribers,
	setupConnectionListeners: (conn: DataConnection) => {
		conn
			.on("open", () => {
				console.log("Connection opened", conn.peer)
			})
			.on("data", (data) => {
				console.log(
					"Data received",
					conn.peer,
					data as {
						jsonrpc: string
						id: number
						method: P2PMessageType
						params: unknown
					},
				)
				subscribers[
					(data as { method: P2PMessageType }).method ||
						// We address unaddressed messages to timesync
						"timesync"
				].forEach((callback) => callback(conn.peer, data))
			})
			.on("close", () => {
				console.log("Connection closed", conn.peer)
			})
			.on("error", (err) => {
				console.error("Connection error", conn.peer, err)
			})
	},
	subscribe: (
		method: P2PMessageType,
		callback: (from: string, data: unknown) => void,
	) => {
		// Add callback to our subscribers
		subscribers[method] = [...(subscribers[method] ?? []), callback]
	},
})

setContext(PEER_CONTEXT_KEY, peer)

onMount(() => {
	const newPeer = new Peer()

	if (!newPeer) {
		throw new Error("Failed to create PeerJS instance")
	}

	newPeer.on("open", (id) => {
		console.log(`PeerJS: Registered as ${id}`)
		peer.instance = newPeer
		peer.id = id

		newPeer.on("connection", (conn) => {
			console.log("PeerJS: New connection from", conn.peer)
			peer.setupConnectionListeners(conn)
		})
	})

	newPeer.on("error", (err) => {
		console.error("PeerJS error:", err)
		peer.instance = undefined
		peer.id = undefined
		throw err
	})
})

onDestroy(() => {
	peer.instance?.destroy()
})

const { children } = $props()
</script>

{#if !peer.id}
	<p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">Connecting...</p>
{:else}
	<p>{peer.id}</p>
	{@render children()}
{/if}
