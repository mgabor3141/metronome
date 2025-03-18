<script lang="ts" module>
import type Peer from "peerjs"
import type { DataConnection } from "peerjs"
import { getGroup } from "./GroupProvider.svelte"
import { getPeer, type PeerContext } from "./PeerProvider.svelte"
import { onDestroy } from "svelte"

const getOpenConnections = (peer: Peer) => {
	const allConnections = peer.connections as Record<string, DataConnection[]>

	console.log(allConnections)

	return Object.fromEntries(
		Object.entries(allConnections)
			.map(([id, connections]) => [id, connections.find((conn) => conn.open)])
			.filter(([_, conn]) => conn !== undefined),
	) as Record<string, DataConnection>
}

export const broadcast = <T>(peer: Peer, data: T) => {
	const connections = getOpenConnections(peer)
	for (const conn of Object.values(connections)) {
		conn.send(data)
	}
}

export const send = <T>(peer: Peer, data: T, target: string) => {
	console.log("Sending to", target, data)
	const allConnections = peer.connections as Record<string, DataConnection[]>

	const conn = allConnections[target]?.find((conn) => conn.open)
	if (!conn) {
		throw new Error(`No connection to peer: ${target}`)
	}

	conn.send(data)
}

const disconnectAll = (peer: Peer) => {
	const allConnections = peer.connections as Record<string, DataConnection[]>

	console.log("Disconnecting all connections:", allConnections)

	Object.values(allConnections)
		.flatMap((connections) => connections.filter((conn) => conn.open))
		.forEach((conn) => conn.close())
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
		.forEach((conn) => conn.close())

	// Connect to new targets
	for (const target of targets) {
		if (target === peer.id || allConnections[target]?.some((conn) => conn.open))
			continue

		peer.instance.connect(target)
	}
}
</script> 

<script lang="ts">
const { children } = $props()

const peer = getPeer()
const groupState = getGroup()

$effect(() => {
    console.log("Syncing connections", $state.snapshot(groupState.members))
    syncConnections(
        peer,
        groupState.members
    )
})

onDestroy(() => {
    disconnectAll(peer.instance)
})
</script>

{@render children()}
