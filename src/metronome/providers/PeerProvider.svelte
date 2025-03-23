<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"

const PEER_CONTEXT_KEY = Symbol("peer")

export type P2PMessageType =
	| "timesync"
	| "metronomeState"
	| "requestInitialState"

export type PeerDataCallback<T> = (peer: Peer, from: string, data: T) => void

export class PeerContext {
	#instance: Peer
	get instance() {
		return this.#instance
	}

	constructor() {
		this.#instance = new Peer()
	}

	get id() {
		return this.#instance.id
	}

	#availableConnections: string[] = $state<string[]>([])
	get availableConnections() {
		return this.#availableConnections
	}

	notify(topic: P2PMessageType, from: string, data: unknown) {
		this.#subscribers[topic].forEach((callback) => {
			callback(this.#instance, from, data)
		})
	}

	setupConnectionListeners(
		conn: DataConnection,
		direction: "inbound" | "outbound",
	) {
		conn
			.on("open", () => {
				console.debug("[P2P] Connection opened", conn.peer)
				if (direction === "inbound") {
					this.availableConnections.push(conn.peer)
				}
			})
			.on("data", (data) => {
				console.debug("[P2P] Received from", conn.peer, data)

				const message = data as { method?: P2PMessageType; result?: unknown }

				if (message.method) {
					this.notify(message.method, conn.peer, data)
				} else if (Object.hasOwn(message, "result")) {
					this.notify("timesync", conn.peer, data)
				} else {
					console.warn("Unknown data", conn.peer, data)
				}
			})
			.on("close", () => {
				console.log("[P2P] Connection closed", conn.peer)
				this.#availableConnections = getPeersWithConnections(this.#instance)
			})
			.on("error", (err) => {
				console.error("[P2P] Connection error with", conn.peer, err)
			})
	}

	#subscribers = $state<Record<P2PMessageType, PeerDataCallback<unknown>[]>>({
		timesync: [],
		metronomeState: [],
		requestInitialState: [],
	})

	subscribe(method: P2PMessageType, callback: PeerDataCallback<unknown>) {
		// Add callback to our subscribers
		console.debug("[P2P] Subscribing to", method)

		if (this.#subscribers[method].length > 50)
			throw new Error("Runaway subscribe loop")

		if (!this.#subscribers[method].includes(callback)) {
			this.#subscribers[method].push(callback)
		}
	}

	unsubscribe(method: P2PMessageType, callback: PeerDataCallback<unknown>) {
		// Remove callback from our subscribers
		console.debug("[P2P] Unsubscribing from", method)
		this.#subscribers[method] = this.#subscribers[method].filter(
			(cb) => cb !== callback,
		)
	}
}

export const getPeerContext = () => {
	return getContext<PeerContext>(PEER_CONTEXT_KEY)
}
</script>

<script lang="ts">
import Peer from "peerjs"
import type { DataConnection } from "peerjs"
import { getStatus } from "./StatusProvider.svelte"
import { getPeersWithConnections } from "./PeerConnectionsProvider.svelte"

const status = getStatus()

const peerContext = new PeerContext()

setContext(PEER_CONTEXT_KEY, peerContext)

onMount(() => {
	peerContext.instance.on("open", (id) => {
		console.log(`[P2P] Registered as ${id}`)
		status.peerConnected = true

		peerContext.instance.on("connection", (conn) => {
			console.log("[P2P] New connection from", conn.peer)
			peerContext.setupConnectionListeners(conn, "inbound")
		})
	})

	peerContext.instance.on("error", (err) => {
		console.error("[P2P] PeerJS error:", err)
		if (err.type !== "disconnected") {
			throw new Error("PeerJS error: " + err.message, {
				cause: err,
			})
		} else {
			console.warn("[P2P] PeerJS error:", err)
		}
	})

	peerContext.instance.on("disconnected", () => {
		console.log("[P2P] Peer disconnected")
		// TODO: Reconnect
		status.peerConnected = false
	})
})

onDestroy(() => {
	peerContext.instance?.destroy()
	status.peerConnected = false
})

const { children } = $props()
</script>

{@render children()}
