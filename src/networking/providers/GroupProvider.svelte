<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"
import { getPeer } from "./PeerProvider.svelte"
import { getGroupCode, saveGroupCode } from "../../utils/code-utils"
import type { GroupStateUpdate } from "../../pages/api/group"

const GROUP_CONTEXT_KEY = Symbol("group")

export const getGroup = () => {
	return getContext<GroupState>(GROUP_CONTEXT_KEY)
}

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
const { children } = $props()

const groupState = $state<GroupState>({
	groupCode: "",
	leader: "",
	members: [],
	isGroupLeader: false,
	connectionStatus: "disconnected",
})

setContext(GROUP_CONTEXT_KEY, groupState)

const peer = getPeer()

let websocket: WebSocket | null = null

onMount(() => {
	// Close any existing connection
	if (websocket && websocket.readyState === WebSocket.OPEN) {
		websocket.close()
	}

	// Check if we have a stored group code
	const storedGroupCode = getGroupCode()

	// Determine if we're on localhost or production
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const host = window.location.host

	// Build the WebSocket URL
	const wsUrl = `${protocol}//${host}/api/group`

	// Create WebSocket connection
	groupState.connectionStatus = "connecting"
	websocket = new WebSocket(wsUrl)

	// Handle connection open
	websocket.onopen = () => {
		console.log("WebSocket connection established")
		websocket?.send(
			JSON.stringify({
				type: "register",
				peerId: peer.id,
				groupCode: storedGroupCode,
			}),
		)

		groupState.connectionStatus = "connected"
	}

	// Handle incoming messages
	websocket.onmessage = async (event) => {
		const message: GroupStateUpdate = JSON.parse(event.data)
		console.log("Received WebSocket message:", message)

		// Handle group updates
		if (message.type === "groupUpdate") {
			saveGroupCode(message.groupCode)

			Object.assign(groupState, {
				...message,
				isGroupLeader: message.leader === peer.id,
			})
		}
	}

	// Handle connection close
	websocket.onclose = () => {
		console.log("WebSocket connection closed")
		groupState.connectionStatus = "disconnected"
	}

	// Handle connection errors
	websocket.onerror = (error) => {
		console.error("WebSocket error:", error)
		groupState.connectionStatus = "disconnected"
	}
})

onDestroy(() => {
	websocket?.close()
})
</script>

{#if groupState.connectionStatus !== "connected"}
    <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">Joining group...</p>
{:else}
	<p>{groupState.groupCode}</p>
	<p>{groupState.isGroupLeader ? "Leader" : "Member"}</p>
	<p>{groupState.members.length} members</p>
    {@render children()}
{/if}
