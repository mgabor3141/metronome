<script lang="ts">
import type { TimingState } from "../components/Metronome.svelte"
import type { GroupState } from "./Networking.svelte"
import { peer } from "./peer-to-peer"
import * as timesync from "timesync"

const {
	timingState = $bindable(),
	groupState,
}: { timingState: TimingState; groupState: GroupState } = $props()

$effect(() => {
	if (groupState.connectionStatus !== "connected") {
		timingState.offset = 0
	}

	if (groupState.isGroupLeader) {
		// No sync needed
		return
	}

	const ts = timesync.create({
		peers: groupState.members.filter((id) => id !== peer.id),
	})

	// Configure the send function to use PeerJS
	ts.send = async (id: string, data: unknown) => {
		const conn = peer.connect(id)
		console.log("conn", conn)

		if (!conn.open) {
			throw new Error(`Not connected to peer: ${id}`)
		}

		await conn.send(data)
	}

	// Set up sync event handlers
	ts.on("sync", (state: unknown) => {
		console.log(`Time sync ${state as "start" | "end"}`)
	})

	// Listen for offset changes
	ts.on("change", (offsetValue: unknown) => {
		const newOffset = offsetValue as number
		timingState.offset = newOffset
		console.log(`Time offset changed: ${newOffset}ms`)
	})

	peer.removeAllListeners("connection")
	peer.on("connection", (conn) => {
		conn.on("open", () => {
			console.debug(`Connected with peer: ${conn.peer}`)
		})

		conn.on("data", (data) => {
			// Handle timesync data
			if (!groupState.isGroupLeader) {
				ts.receive(conn.peer, data)
			}
		})

		conn.on("close", () => {
			console.debug(`Disconnected from peer: ${conn.peer}`)
		})

		conn.on("error", (err) => {
			console.error(`Connection error with ${conn.peer}:`, err)
		})
	})
})
</script>

<div class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
	<p>Time offset: {timingState.offset}ms</p>
</div>
