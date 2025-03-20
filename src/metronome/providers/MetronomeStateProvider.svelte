<!-- @hmr:keep-all -->
<script lang="ts" module>
import { getContext, onDestroy, onMount, setContext } from "svelte"

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
	Object.assign(current, { ...newState, referenceTime: undefined })
}
</script>

<script lang="ts">
import { getPeerConnections, send } from "./PeerConnectionsProvider.svelte"
import { getPeer } from "./PeerProvider.svelte"
import { getGroup } from "./GroupProvider.svelte"
import DebugString from "../../components/DebugString.svelte"

const { children } = $props()

const peer = getPeer()
const groupState = getGroup()
const peerConnections = getPeerConnections()

const metronomeState = $state<MetronomeState>({} as MetronomeState)

setContext(METRONOME_STATE_CONTEXT_KEY, metronomeState)

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
	if (!metronomeState.bpm && peerConnections.live) {
		if (groupState.isGroupLeader) {
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

{@render children()}
<DebugString {metronomeState} />
