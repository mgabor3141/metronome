<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"
import { getPeerContext } from "./PeerProvider.svelte"
import { getGroupCode, saveGroupCode } from "../../utils/code-utils"

const GROUP_CONTEXT_KEY = Symbol("group")
const GROUP_URL_PARAM = "join"

export const getGroup = () => {
	return getContext<GroupState>(GROUP_CONTEXT_KEY)
}

export type GroupState = {
	groupCode: string
	leader: string
	members: string[]
	isGroupLeader: boolean
}

export type GroupStateUpdate = Omit<
	GroupState,
	"connectionStatus" | "isGroupLeader"
> & {
	type: "groupUpdate"
}
</script>

<script lang="ts">
import { getStatus } from "./StatusProvider.svelte"

const status = getStatus()

const groupState = $state<GroupState>({
	groupCode: "",
	leader: "",
	members: [],
	isGroupLeader: false,
})

setContext(GROUP_CONTEXT_KEY, groupState)

const peer = getPeerContext()

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

let websocketOpen = $state(false)
const readyForRegister = $derived(websocketOpen && status.peerConnected)

onMount(() => {
	// Close any existing connection
	if (websocket && websocket.readyState === WebSocket.OPEN) {
		websocket.close()
	}

	// Determine if we're on localhost or production
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
	const host = window.location.host

	// Build the WebSocket URL
	const wsUrl = `${protocol}//${host}/api/group`

	// Create WebSocket connection
	websocket = new WebSocket(wsUrl)

	// Handle connection open
	websocket.onopen = () => {
		console.log("[SERVER] WebSocket connection established")
		websocketOpen = true
	}

	// Handle incoming messages
	websocket.onmessage = async (event) => {
		const message: GroupStateUpdate = JSON.parse(event.data)

		// Handle group updates
		if (message.type === "groupUpdate") {
			saveGroupCode(message.groupCode)

			const isGroupLeader = message.leader === peer.id

			Object.assign(groupState, {
				...message,
				isGroupLeader,
			})

			status.serverConnected = true
		}
	}

	// Handle connection close
	websocket.onclose = () => {
		console.log("[SERVER] WebSocket connection closed")
		// TODO: Reconnect
		status.serverConnected = false
	}

	// Handle connection errors
	websocket.onerror = (error) => {
		console.error("WebSocket error:", error)
	}
})

onDestroy(() => {
	websocket?.close()
})

$effect(() => {
	if (readyForRegister) {
		// Get group code from URL if present
		const urlGroupCode = getGroupCodeFromUrl()

		// Check if we have a stored group code
		const storedGroupCode = getGroupCode()

		websocket?.send(
			JSON.stringify({
				type: "register",
				peerId: peer.id,
				groupCode: urlGroupCode || storedGroupCode,
			}),
		)
	}
})

const { children } = $props()
</script>

{@render children()}
