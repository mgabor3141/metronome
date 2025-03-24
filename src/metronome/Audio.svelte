<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 * Simplified to work with PeerJS time synchronization
 */
import * as Tone from "tone"
import type { MetronomeState } from "./providers/MetronomeStateProvider.svelte"
import {
	getReferenceTime,
	getTransportPositionSeconds,
} from "../utils/timing-utils"
import { deepEqual } from "../utils/object-utils"
import { getMetronomeState } from "./providers/MetronomeStateProvider.svelte"
import { getClock } from "./providers/ClockProvider.svelte"
import { getStatus } from "./providers/StatusProvider.svelte"
import { onDestroy } from "svelte"

const status = getStatus()
const metronomeState = getMetronomeState()
const clock = getClock()

// Constants for audio settings
const NOTE_DURATION = 0.1
const ACCENT_NOTE = "C5"
const REGULAR_NOTE = "G4"
const ACCENT_VELOCITY = 0.7
const REGULAR_VELOCITY = 0.6

let lastKnownTimingOffset = clock.offset
let lastKnownState: MetronomeState & { hasUserInteracted: boolean } = {
	...metronomeState,
	hasUserInteracted: status.hasUserInteracted,
}

// References to Tone.js objects - defined outside of functions to persist between renders
let synth: Tone.Synth | null = null

/**
 * Creates a synth instance for sound generation if it doesn't exist
 */
const getSynth = (): Tone.Synth => {
	if (!synth) {
		synth = new Tone.Synth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.1 },
			volume: -6,
		}).toDestination()
	}
	return synth
}

const part = new Tone.Part((time, { note, velocity }) => {
	const currentSynth = getSynth()

	currentSynth.triggerAttackRelease(note, NOTE_DURATION, time, velocity)
}, [])

/**
 * Creates a metronome sequence for the full measure
 * Each beat in the measure will be played, with the first beat accented
 */
const createMetronomeSequence = () => {
	const { beatsPerMeasure, beatUnit } = metronomeState.timeSignature

	// Create an array of beat indices for the sequence
	// Each element represents a beat in the measure
	return Array.from({ length: beatsPerMeasure }, (_, i) => ({
		time: { [`${beatUnit}n`]: i },
		note: i === 0 ? ACCENT_NOTE : REGULAR_NOTE,
		velocity: i === 0 ? ACCENT_VELOCITY : REGULAR_VELOCITY,
	}))
}

/**
 * Starts the metronome with the correct timing based on time synchronization
 */
const updatePlaybackWithState = async (
	state: MetronomeState,
): Promise<void> => {
	// Make sure audio context is running
	if (Tone.getContext().state !== "running") {
		await Tone.start()
	}

	const transport = Tone.getTransport()

	if (!state.isPlaying) {
		if (transport.state === "started") transport.stop()
		return
	}

	const isStarting = transport.state !== "started"

	// Set the tempo
	transport.bpm.value = state.bpm
	transport.timeSignature = [
		state.timeSignature.beatsPerMeasure,
		state.timeSignature.beatUnit,
	]
	transport.loop = true
	transport.loopStart = 0
	transport.loopEnd = "1m"

	// Create a new sequence with current settings
	const sequence = createMetronomeSequence()
	part.clear()
	sequence.forEach((beat) => {
		part.add(beat)
	})
	part.start(0)

	const START_DELAY = 0.1
	const LOOKAHEAD = Tone.getContext().lookAhead
	const START_DELAY_WITH_LOOKAHEAD = START_DELAY + LOOKAHEAD

	const measureLengthSeconds = transport.toSeconds("1m")

	if (state.referenceTime) {
		// If we have a reference time, we adjust to it
		const transportOffset = getTransportPositionSeconds({
			currentTime: clock.now(),
			referenceTime: state.referenceTime,
			measureLengthSeconds,
			optionalStartDelaySeconds: isStarting
				? START_DELAY_WITH_LOOKAHEAD
				: LOOKAHEAD,
		})

		if (isStarting) {
			transport.start(`+${START_DELAY}`, transportOffset)
		} else {
			transport.position = transportOffset
		}
	} else {
		// Otherwise we calculate the reference time
		if (isStarting) {
			// If we don't have a reference time, and we are starting
			metronomeState.referenceTime = getReferenceTime({
				currentTime: clock.now(),
				transportSeconds: 0,
				optionalStartDelaySeconds: START_DELAY_WITH_LOOKAHEAD,
			})

			transport.start(`+${START_DELAY}`, 0)
		} else {
			// If we don't have a reference time, and we are playing
			metronomeState.referenceTime = getReferenceTime({
				currentTime: clock.now(),
				transportSeconds: transport.progress * measureLengthSeconds,
				optionalStartDelaySeconds: LOOKAHEAD,
			})
		}
	}
}

// Watch for state changes
$effect(() => {
	if (
		!deepEqual(
			{
				...metronomeState,
				hasUserInteracted: status.hasUserInteracted,
				referenceTime: undefined,
			},
			{ ...lastKnownState, referenceTime: undefined },
		) ||
		lastKnownTimingOffset !== clock.offset
	) {
		if (status.hasUserInteracted) {
			updatePlaybackWithState(metronomeState)
		}

		lastKnownState = {
			...metronomeState,
			hasUserInteracted: status.hasUserInteracted,
		}
		lastKnownTimingOffset = clock.offset
	}
})

onDestroy(() => {
	Tone.getTransport().stop()
})
</script>
