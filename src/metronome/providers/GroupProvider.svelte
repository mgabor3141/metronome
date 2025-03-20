<!-- @hmr:keep-all -->
<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"
import { getPeer } from "./PeerProvider.svelte"
import { getGroupCode, saveGroupCode } from "../../utils/code-utils"
import DebugString from "../../components/DebugString.svelte"

const GROUP_CONTEXT_KEY = Symbol("group")
const GROUP_URL_PARAM = "join"

export const getGroup = () => {
	return getContext<GroupState>(GROUP_CONTEXT_KEY)
}

export type ConnectionStatus =
	| "connecting"
	| "initializing"
	| "connected"
	| "disconnected"

export type GroupState = {
	groupCode: string
	leader: string
	members: string[]
	isGroupLeader: boolean
	connectionStatus: ConnectionStatus
}

export type GroupStateUpdate = Omit<
	GroupState,
	"connectionStatus" | "isGroupLeader"
> & {
	type: "groupUpdate"
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

const getGroupCodeFromUrl = () => {
	// Get group code from URL
	const url = new URL(window.location.href)
	const urlGroupCode = url.searchParams.get(GROUP_URL_PARAM)
	if (urlGroupCode) {
		saveGroupCode(urlGroupCode)

		// Remove from URL
		url.searchParams.delete(GROUP_URL_PARAM)
		window.history.replaceState(null, "", url.toString())
	}
	return urlGroupCode
}

onMount(() => {
	// Close any existing connection
	if (websocket && websocket.readyState === WebSocket.OPEN) {
		websocket.close()
	}

	// Get group code from URL if present
	const urlGroupCode = getGroupCodeFromUrl()

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
		console.log("[SERVER] WebSocket connection established")
		websocket?.send(
			JSON.stringify({
				type: "register",
				peerId: peer.id,
				groupCode: urlGroupCode || storedGroupCode,
			}),
		)

		groupState.connectionStatus = "initializing"
	}

	// Handle incoming messages
	websocket.onmessage = async (event) => {
		const message: GroupStateUpdate = JSON.parse(event.data)
		console.debug("[SERVER] Received WebSocket message:", message)

		// Handle group updates
		if (message.type === "groupUpdate") {
			saveGroupCode(message.groupCode)

			const isGroupLeader = message.leader === peer.id

			Object.assign(groupState, {
				...message,
				isGroupLeader,
			})

			groupState.connectionStatus = "connected"
		}
	}

	// Handle connection close
	websocket.onclose = () => {
		console.log("[SERVER] WebSocket connection closed")
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
	<p class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
		Joining group...
	</p>
{:else}
	{@render children()}
	<DebugString {groupState} />
{/if}
