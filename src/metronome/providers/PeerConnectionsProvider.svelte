<script lang="ts" module>
import type Peer from "peerjs"
import type { DataConnection } from "peerjs"
import { getGroup } from "./GroupProvider.svelte"
import {
	type P2PMessageType,
	type PeerContext,
	getPeerContext,
} from "./PeerProvider.svelte"
import { getContext, onDestroy, setContext } from "svelte"
import { getStatus } from "./StatusProvider.svelte"

const PEER_CONNECTIONS_CONTEXT_KEY = Symbol("peerConnections")

export type PeerConnectionsContext = {
	live: boolean
}

export const getPeerConnections = () => {
	return getContext<PeerConnectionsContext>(PEER_CONNECTIONS_CONTEXT_KEY)
}

const getOpenConnections = (peer: Peer) => {
	const allConnections = peer.connections as Record<string, DataConnection[]>

	return Object.fromEntries(
		Object.entries(allConnections)
			.map(([id, connections]) => [id, connections.find((conn) => conn.open)])
			.filter(([_, conn]) => conn !== undefined),
	) as Record<string, DataConnection>
}

export type P2PMessage<T> = {
	method: P2PMessageType
} & T

export const broadcast = <T,>(peer: Peer, data: P2PMessage<T>) => {
	console.debug("[P2P] Broadcasting:", { ...data })
	const connections = getOpenConnections(peer)
	for (const conn of Object.values(connections)) {
		conn.send(data)
	}
}

export const send = <T,>(peer: Peer, data: P2PMessage<T>, target: string) => {
	const allConnections = peer.connections as Record<string, DataConnection[]>

	const conn = allConnections[target]?.find((conn) => conn.open)
	if (!conn) {
		throw new Error(`No connection to peer: ${target}`)
	}

	conn.send(data)
}

const disconnectAll = (peer: Peer) => {
	const allConnections = peer.connections as Record<string, DataConnection[]>

	Object.values(allConnections)
		.flatMap((connections) => connections.filter((conn) => conn.open))
		.forEach((conn) => {
			conn.close()
		})
}

export const getPeersWithConnections = (peer: Peer): string[] => {
	return Object.keys(getOpenConnections(peer))
}

const syncConnections = (peer: PeerContext, targets: string[]) => {
	if (!peer.instance) {
		throw new Error("Peer not initialized")
	}

	const allConnections = peer.instance.connections as Record<
		string,
		DataConnection[]
	>

	// Disconnect unnecessary connections
	Object.entries(allConnections)
		.filter(([id]) => !targets.includes(id))
		.flatMap(([_, connections]) => connections.filter((conn) => conn.open))
		.forEach((conn) => {
			conn.close()
		})

	// Connect to new targets
	for (const target of targets) {
		if (
			target === peer.id ||
			(allConnections[target]?.some((conn) => conn.open) ?? false)
		)
			continue

		console.debug("[P2P] Connecting to", target)
		peer.instance.connect(target)
	}
}
</script>

<script lang="ts">
const status = getStatus()
const peer = getPeerContext()
const groupState = getGroup()

const peerConnections = $state<PeerConnectionsContext>({
	live: false,
})

setContext(PEER_CONNECTIONS_CONTEXT_KEY, peerConnections)

$effect(() => {
	peerConnections.live = false
	if (!status.connected) return

	console.debug("[P2P] Updating connection pool...")
	syncConnections(peer, groupState.members)
})

$effect(() => {
	if (!status.connected) return

	const allConnected = groupState.members
		.filter((id) => id !== peer.id)
		.every((id) => peer.availableConnections.includes(id))

	const timeout = setTimeout(() => {
		// TODO: Fix this with an ack
		peerConnections.live = allConnected
	}, 200)

	return () => {
		clearTimeout(timeout)
	}
})

onDestroy(() => {
	peerConnections.live = false
	disconnectAll(peer.instance)
})

const { children } = $props()
</script>

{@render children()}
