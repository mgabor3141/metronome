<script lang="ts">
import { onDestroy, onMount } from "svelte"
import {
	getPeerConnections,
	send,
} from "./providers/PeerConnectionsProvider.svelte"
import { getPeer } from "./providers/PeerProvider.svelte"
import { getGroup } from "./providers/GroupProvider.svelte"
import type { MetronomeState } from "../Metronome.svelte"

let {
	metronomeState,
	waitingForInitialState = $bindable(),
}: { metronomeState: MetronomeState; waitingForInitialState: boolean } =
	$props()

const peer = getPeer()
const groupState = getGroup()
const peerConnections = getPeerConnections()

let initialStateRequestHandler: (from: string) => void

onMount(() => {
	initialStateRequestHandler = (from) => {
		send(
			peer.instance,
			{
				method: "metronomeState",
				state: metronomeState,
			},
			from,
		)
	}

	peer.subscribe("requestInitialState", initialStateRequestHandler)
})

onDestroy(() => {
	peer.unsubscribe("requestInitialState", initialStateRequestHandler)
})

$effect(() => {
	if (waitingForInitialState && peerConnections.live) {
		if (groupState.isGroupLeader) {
			waitingForInitialState = false
			return
		}

		console.log("Requesting initial state...")
		send(
			peer.instance,
			{
				method: "requestInitialState",
			},
			groupState.leader,
		)
	}
})
</script>
