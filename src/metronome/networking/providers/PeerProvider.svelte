<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"

const PEER_CONTEXT_KEY = Symbol("peer")

export type P2PMessageType =
	| "timesync"
	| "metronomeState"
	| "requestInitialState"

export type PeerDataCallback<T> = (from: string, data: T) => void

export type PeerContext = {
	instance: Peer
	id: string
	/**
	 * Array of peer IDs that have open connections that have handlers set up
	 */
	availableConnections: string[]
	subscribers: Record<P2PMessageType, PeerDataCallback<unknown>[]>
	setupConnectionListeners: (
		conn: DataConnection,
		direction: "inbound" | "outbound",
	) => void
	subscribe: (
		method: P2PMessageType,
		callback: (from: string, data: unknown) => void,
	) => void
	unsubscribe: (
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
import DebugString from "../../../components/DebugString.svelte"

const subscribers = $state<Record<P2PMessageType, PeerDataCallback<unknown>[]>>(
	{
		timesync: [],
		metronomeState: [],
		requestInitialState: [],
	},
)

const notify = (topic: P2PMessageType, from: string, data: unknown) => {
	subscribers[topic].forEach((callback) => {
		callback(from, data)
	})
}

const peer = $state<
	Omit<PeerContext, "instance" | "id"> & Partial<PeerContext>
>({
	subscribers,
	availableConnections: [],
	setupConnectionListeners: (
		conn: DataConnection,
		direction: "inbound" | "outbound",
	) => {
		conn
			.on("open", () => {
				console.debug("[P2P] Connection opened", conn.peer, performance.now())
				if (direction === "inbound") {
					peer.availableConnections.push(conn.peer)
				}
			})
			.on("data", (data) => {
				console.debug("Received from", conn.peer, data)

				const message = data as { method?: P2PMessageType; result?: unknown }

				if (message.method) {
					notify(message.method, conn.peer, data)
				} else if (Object.hasOwn(message, "result")) {
					notify("timesync", conn.peer, data)
				} else {
					console.warn("Unknown data", conn.peer, data)
				}
			})
			.on("close", () => {
				console.log("[P2P] Connection closed", conn.peer)
				peer.availableConnections.splice(
					peer.availableConnections.indexOf(conn.peer),
					1,
				)
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
		subscribers[method].push(callback)
	},
	unsubscribe: (
		method: P2PMessageType,
		callback: (from: string, data: unknown) => void,
	) => {
		// Remove callback from our subscribers
		subscribers[method] = subscribers[method].filter((cb) => cb !== callback)
	},
})

setContext(PEER_CONTEXT_KEY, peer)

onMount(() => {
	const newPeer = new Peer()

	if (!newPeer) {
		throw new Error("Failed to create PeerJS instance")
	}

	newPeer.on("open", (id) => {
		console.log(`[P2P] Registered as ${id}`)
		peer.instance = newPeer
		peer.id = id

		newPeer.on("connection", (conn) => {
			console.log("[P2P] New connection from", conn.peer)
			peer.setupConnectionListeners(conn, "inbound")
		})
	})

	newPeer.on("error", (err) => {
		console.error("PeerJS error:", err)
	})
})

onDestroy(() => {
	peer.instance?.destroy()
})

const { children } = $props()
</script>

{#if !peer.id}
	<p class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
		Connecting...
	</p>
{:else}
	<DebugString peerId={peer.id} openConnections={peer.availableConnections} />
	{@render children()}
{/if}
