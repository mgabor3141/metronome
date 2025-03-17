<script lang="ts" module>
import { registerPeer } from "./peer-to-peer"
import { joinGroup } from "./group-client"
import { onMount } from "svelte"

export type ConnectionStatus = "connecting" | "connected" | "disconnected"

export type GroupState = {
	groupCode: string
	leader: string
	members: string[]
	isGroupLeader: boolean
	connectionStatus: ConnectionStatus
}
</script>

<script lang="ts">
const { metronomeState = $bindable() } = $props()

let groupState = $state<GroupState>({
	groupCode: "",
	leader: "",
	members: [],
	isGroupLeader: false,
	connectionStatus: "disconnected",
})
let peerId = $state<string | undefined>()

onMount(() => {
	registerPeer().then((id) => {
		peerId = id

		joinGroup(id, (dispatch) => {
			groupState = dispatch(groupState)
		})
	})
})
</script>

<div class="network-status text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	{#if !peerId}
		<p>Connecting...</p>
	{:else if groupState.connectionStatus !== "connected"}
		<p>Joining group...</p>
	{:else}
		<p>
			Connected to group <span class="font-mono font-bold">{groupState?.groupCode}</span>
		</p>
		<pre class="text-left w-fit mx-auto">{JSON.stringify(groupState, null, 2)}</pre>
	{/if}
</div>
