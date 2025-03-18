<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"

const PEER_CONTEXT_KEY = Symbol("peer")

export type PeerContext = {
	instance: Peer
	id: string
}

export const getPeer = () => {
	return getContext<PeerContext>(PEER_CONTEXT_KEY)
}
</script>

<script lang="ts">
import Peer from "peerjs"

const { children } = $props()

const peer = $state<Partial<PeerContext>>({})

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
	})

	newPeer.on("error", (err) => {
		console.error("PeerJS error:", err)
		peer.instance = undefined
		peer.id = undefined
		throw err
	})

	// TODO: Reconnect
})

onDestroy(() => {
	peer.instance?.destroy()
})
</script>

{#if !peer.id}
	<p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">Connecting...</p>
{:else}
	<p>{peer.id}</p>
	{@render children()}
{/if}
