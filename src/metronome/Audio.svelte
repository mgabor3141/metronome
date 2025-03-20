<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 * Simplified to work with PeerJS time synchronization
 */
import * as Tone from "tone"
import type { MetronomeState, TimingState } from "./Metronome.svelte"
import {
	getReferenceTime,
	getTransportPositionSeconds,
} from "../utils/timing-utils"
import { deepEqual } from "../utils/object-utils"

type MetronomeAudioProps = {
	metronomeState: MetronomeState
	hasUserInteracted: boolean
	timingState: TimingState
}

const {
	metronomeState = $bindable(),
	hasUserInteracted,
	timingState,
}: MetronomeAudioProps = $props()

// Constants for audio settings
const NOTE_DURATION = 0.1
const ACCENT_NOTE = "C5"
const REGULAR_NOTE = "G4"
const ACCENT_VELOCITY = 0.7
const REGULAR_VELOCITY = 0.6

let lastKnownState: MetronomeState = $state(metronomeState)
let lastKnownTimingOffset = $state(timingState.offset)
let audioInitialized = $state(false)

/**
 * Initializes the audio context and Tone.js
 * Only called after a user gesture (when play is clicked)
 */
const initAudio = async (): Promise<void> => {
	if (audioInitialized) return

	try {
		if (Tone.getContext().state === "closed") {
			Tone.setContext(new AudioContext())
		}

		// Initialize audio context
		audioInitialized = true
		console.log("Audio context initialized successfully")
	} catch (error) {
		console.error("Failed to initialize audio context:", error)
		throw error
	}
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
	justStarted: boolean,
): Promise<void> => {
	// Initialize audio if needed (only on user gesture)
	if (!audioInitialized) {
		await initAudio()
	}

	// Make sure audio context is running
	if (Tone.getContext().state !== "running") {
		await Tone.start()
	}

	const transport = Tone.getTransport()

	if (!state.isPlaying) {
		if (transport.state === "started") transport.stop()
		return
	}

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

	if (state.referenceTime) {
		// If we have a reference time, we adjust to it
		const transportOffset = getTransportPositionSeconds(
			state.referenceTime,
			transport.toSeconds("1m"),
			timingState.offset,
			justStarted ? START_DELAY + Tone.getContext().lookAhead : 0,
		)

		if (justStarted) {
			transport.start(`+${START_DELAY}`, transportOffset)
		} else {
			transport.position = transportOffset
		}
	} else {
		// Otherwise we calculate the reference time
		if (justStarted) {
			// If we don't have a reference time, and we are starting
			metronomeState.referenceTime = getReferenceTime(
				0,
				timingState.offset,
				START_DELAY + Tone.getContext().lookAhead,
			)

			transport.start(`+${START_DELAY}`, 0)
		} else {
			// If we don't have a reference time, and we are playing
			metronomeState.referenceTime = getReferenceTime(
				transport.progress * transport.toSeconds("1m"),
				timingState.offset,
			)
		}
	}
}

// Watch for state changes
$effect(() => {
	// Skip if user hasn't interacted yet
	if (!hasUserInteracted) return

	if (
		!deepEqual(
			{ ...metronomeState, referenceTime: undefined },
			{ ...lastKnownState, referenceTime: undefined },
		) ||
		lastKnownTimingOffset !== timingState.offset
	) {
		updatePlaybackWithState(
			metronomeState,
			lastKnownState.isPlaying !== metronomeState.isPlaying,
		)
		lastKnownState = metronomeState
		lastKnownTimingOffset = timingState.offset
	}
})
</script>
