<!-- @hmr:keep-all -->
<script lang="ts" module>
import { getContext, onDestroy, setContext } from "svelte"

export type TimeSignature = {
	beatsPerMeasure: number
	beatUnit: number
}

export type MetronomeState = {
	bpm: number
	timeSignature: TimeSignature
	isPlaying: boolean

	/**
	 * Time of the "one" beat of the current measure
	 * Undefined until the local playback actually picks up the update
	 */
	referenceTime: number | undefined
}

const METRONOME_STATE_CONTEXT_KEY = Symbol("metronomeState")

export const getMetronomeState = () => {
	return getContext<MetronomeState>(METRONOME_STATE_CONTEXT_KEY)
}

export const setMetronomeStateLocal = (
	current: MetronomeState,
	newState: Partial<MetronomeState>,
) => {
	const tmp = { ...current, ...newState }
	tmp.referenceTime =
		// We normally unset the reference time, unless it's a join event
		current.isPlaying === newState?.isPlaying
			? current.referenceTime
			: undefined

	Object.assign(current, tmp)
}
</script>

<script lang="ts">
import DebugString from "../../components/DebugString.svelte"
import { getGroup } from "./GroupProvider.svelte"
import { getPeerConnections, send } from "./PeerConnectionsProvider.svelte"
import { getPeerContext, type PeerDataCallback } from "./PeerProvider.svelte"
import { getStatus } from "./StatusProvider.svelte"

const status = getStatus()
const peerContext = getPeerContext()
const groupState = getGroup()
const peerConnections = getPeerConnections()

const metronomeState = $state<MetronomeState>({} as MetronomeState)

setContext(METRONOME_STATE_CONTEXT_KEY, metronomeState)

const initialStateRequestHandler: PeerDataCallback<unknown> = (peer, from) => {
	console.log("[INIT] Received initial state request from", from)
	send(
		peer,
		{
			method: "metronomeState",
			state: metronomeState,
		},
		from,
	)
}

$effect(() => {
	if (!status.connected) return

	peerContext.subscribe("requestInitialState", initialStateRequestHandler)
})

onDestroy(() => {
	peerContext.unsubscribe("requestInitialState", initialStateRequestHandler)
})

$effect(() => {
	// We can't get initial state if we're not connected yet, and we don't need it if we have a state already
	if (status.connected === undefined || metronomeState.bpm) return

	if (
		// If we are connected as group leader or have failed to connect
		status.connected === false ||
		(status.connected === true && groupState.isGroupLeader)
	) {
		// We create our own state
		console.log("[INIT] Initializing as leader")
		Object.assign(metronomeState, {
			bpm: 120,
			timeSignature: {
				beatsPerMeasure: 4,
				beatUnit: 4,
			},
			isPlaying: false,
			referenceTime: undefined,
		})
		return
	} else {
		// If we need to request the state instead, we need to wait for peer connections
		if (!peerConnections.live) return

		console.log("[INIT] Requesting initial state...")
		send(
			peerContext.instance,
			{
				method: "requestInitialState",
			},
			groupState.leader,
		)
	}
})

const { children } = $props()
</script>

{@render children()}
<DebugString {metronomeState} />
