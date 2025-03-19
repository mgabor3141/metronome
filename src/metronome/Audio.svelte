<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 * Simplified to work with PeerJS time synchronization
 */
import * as Tone from "tone"
import type { MetronomeState, TimingState } from "./Metronome.svelte"
import { onDestroy, onMount } from "svelte"
import { getTransportSeconds } from "../utils/timing-utils"

interface MetronomeAudioProps {
	metronomeState: MetronomeState
	hasUserInteracted: boolean
	timingState: TimingState
}

let { metronomeState = $bindable(), ...props }: MetronomeAudioProps = $props()
const { hasUserInteracted, timingState } = props

// Constants for audio settings
const NOTE_DURATION = 0.1
const ACCENT_NOTE = "C5"
const REGULAR_NOTE = "G4"
const ACCENT_VELOCITY = 0.7
const REGULAR_VELOCITY = 0.6

// Audio state
type AudioState = {
	lastBpm: number
	lastTimeSignature: {
		beatsPerMeasure: number
		beatUnit: number
	}
	lastIsPlaying: boolean
	audioInitialized: boolean
}

const audioState = $state<AudioState>({
	lastBpm: metronomeState.bpm,
	lastTimeSignature: {
		beatsPerMeasure: metronomeState.timeSignature.beatsPerMeasure,
		beatUnit: metronomeState.timeSignature.beatUnit,
	},
	lastIsPlaying: false,
	audioInitialized: false,
})

// References to Tone.js objects - defined outside of functions to persist between renders
let audioContext: AudioContext | null = null
let synth: Tone.Synth | null = null

const part = new Tone.Part((time, { note, velocity }) => {
	playBeat(time, note, velocity)
}, [])

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

/**
 * Initializes the audio context and Tone.js
 * Only called after a user gesture (when play is clicked)
 */
const initAudio = async (): Promise<void> => {
	if (audioState.audioInitialized) return

	try {
		if (Tone.getContext().state === "closed") {
			Tone.setContext(new AudioContext())
		}

		// Initialize audio context
		audioContext = Tone.getContext().rawContext as AudioContext
		audioState.audioInitialized = true
		console.log("Audio context initialized successfully")
	} catch (error) {
		console.error("Failed to initialize audio context:", error)
		throw error
	}
}

/**
 * Plays a single beat with the given parameters
 */
const playBeat = (time: number, note: string, velocity: number): void => {
	const currentSynth = getSynth()

	currentSynth.triggerAttackRelease(note, NOTE_DURATION, time, velocity)
}

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
const startMetronome = async (): Promise<void> => {
	// Initialize audio if needed (only on user gesture)
	if (!audioState.audioInitialized) {
		await initAudio()
	}

	// Make sure audio context is running
	if (audioContext?.state !== "running") {
		await Tone.start()
	}

	// Set the tempo
	const transport = Tone.getTransport()
	transport.bpm.value = metronomeState.bpm
	transport.timeSignature = [
		metronomeState.timeSignature.beatsPerMeasure,
		metronomeState.timeSignature.beatUnit,
	]

	// Create a new sequence with current settings
	const sequence = createMetronomeSequence()
	part.clear()
	sequence.forEach((beat) => {
		part.add(beat)
	})
	part.start(0)

	// Start the sequence and transport with the calculated delay
	console.log("Starting metronome", metronomeState.referenceTime)

	if (metronomeState.referenceTime) {
		transport.position = getTransportSeconds(
			metronomeState.referenceTime,
			metronomeState.timeSignature.beatsPerMeasure * (60 / metronomeState.bpm),
			timingState.offset,
		)
	} else {
		console.log("huh")

		transport.position = 0
		metronomeState = {
			...metronomeState,
			referenceTime: new Date().getTime() + timingState.offset,
		}
	}
	transport.loop = true
	transport.loopStart = 0
	transport.loopEnd = "1m"
	transport.start()

	// Update playback state
	audioState.lastBpm = metronomeState.bpm
	audioState.lastTimeSignature = { ...metronomeState.timeSignature }
	audioState.lastIsPlaying = true
}

/**
 * Stops the metronome playback
 */
const stopMetronome = (): void => {
	Tone.getTransport().stop()
	audioState.lastIsPlaying = false
}

/**
 * Updates the metronome when settings change
 */
const updateMetronome = async (): Promise<void> => {
	// If not playing, just update the stored values
	if (!metronomeState.isPlaying) {
		audioState.lastBpm = metronomeState.bpm
		audioState.lastTimeSignature = { ...metronomeState.timeSignature }
		return
	}

	// If already playing and settings changed, restart with new settings
	if (
		metronomeState.bpm !== audioState.lastBpm ||
		metronomeState.timeSignature.beatsPerMeasure !==
			audioState.lastTimeSignature.beatsPerMeasure ||
		metronomeState.timeSignature.beatUnit !==
			audioState.lastTimeSignature.beatUnit
	) {
		await startMetronome()
	}
}

// Watch for state changes
$effect(() => {
	// Skip if user hasn't interacted yet
	if (!hasUserInteracted) return

	console.log("State changed", metronomeState)

	// Handle play/pause state changes
	if (metronomeState.isPlaying !== audioState.lastIsPlaying) {
		if (metronomeState.isPlaying) {
			startMetronome()
		} else {
			stopMetronome()
		}
	}
	// Handle other state changes while playing
	else if (metronomeState.isPlaying) {
		updateMetronome()
	}
})

$effect(() => {
	if (Tone.getContext().state !== "closed") {
		Tone.getTransport().position = metronomeState.referenceTime
			? getTransportSeconds(
					metronomeState.referenceTime,
					metronomeState.timeSignature.beatsPerMeasure *
						(60 / metronomeState.bpm),
					timingState.offset,
				)
			: 0
	}
})

// Clean up on component destroy
onDestroy(() => {
	// Stop and clean up sequence
	if (part) {
		part.stop().dispose()
		Tone.getContext().dispose()
	}
})
</script>
