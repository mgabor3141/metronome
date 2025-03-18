<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 * Simplified to work with PeerJS time synchronization
 */
import * as Tone from "tone"
import type { MetronomeState, TimingState } from "./Metronome.svelte"
import { onDestroy } from "svelte"
import { calculateSyncOffset } from "../utils/timing-utils"

interface MetronomeAudioProps {
	metronomeState: MetronomeState
	hasUserInteracted: boolean
	timingState: TimingState
}

const props: MetronomeAudioProps = $props()

// Constants for audio settings
const NOTE_DURATION = 0.1
const ACCENT_NOTE = "C5"
const REGULAR_NOTE = "G4"
const ACCENT_VELOCITY = 0.7
const REGULAR_VELOCITY = 0.5

// Audio state
type AudioState = {
	lastBpm: number
	currentBeat: number
	lastTimeSignature: {
		beatsPerMeasure: number
		beatUnit: number
	}
	lastIsPlaying: boolean
	audioInitialized: boolean
}

const audioState = $state<AudioState>({
	lastBpm: props.metronomeState.bpm,
	currentBeat: 0,
	lastTimeSignature: {
		beatsPerMeasure: props.metronomeState.timeSignature.beatsPerMeasure,
		beatUnit: props.metronomeState.timeSignature.beatUnit,
	},
	lastIsPlaying: false,
	audioInitialized: false,
})

// References to Tone.js objects - defined outside of functions to persist between renders
let audioContext: AudioContext | null = null
let synth: Tone.Synth | null = null
let loop: Tone.Loop | null = null

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
 * Plays a single beat with the given parameters
 */
const playBeat = (time: number, beatInfo: { isAccented: boolean }): void => {
	const currentSynth = getSynth()
	const note = beatInfo.isAccented ? ACCENT_NOTE : REGULAR_NOTE
	const velocity = beatInfo.isAccented ? ACCENT_VELOCITY : REGULAR_VELOCITY

	currentSynth.triggerAttackRelease(note, NOTE_DURATION, time, velocity)
}

/**
 * Initializes the audio context and Tone.js
 * Only called after a user gesture (when play is clicked)
 */
const initAudio = async (): Promise<void> => {
	if (audioState.audioInitialized) return

	try {
		// Initialize audio context
		await Tone.start()
		audioContext = Tone.getContext().rawContext as AudioContext
		audioState.audioInitialized = true
		console.log("Audio context initialized successfully")
	} catch (error) {
		console.error("Failed to initialize audio context:", error)
		throw error
	}
}

/**
 * Creates or updates the metronome loop based on current settings
 */
const createMetronomeLoop = (): Tone.Loop => {
	// Create new pattern
	const newLoop = new Tone.Loop((time: number) => {
		if (
			audioState.currentBeat >=
			props.metronomeState.timeSignature.beatsPerMeasure
		) {
			audioState.currentBeat = 0
		}

		playBeat(time, { isAccented: audioState.currentBeat === 0 })
		audioState.currentBeat++
	}, `${props.metronomeState.timeSignature.beatUnit}n`)

	return newLoop
}

/**
 * Starts the metronome with the correct timing based on time synchronization
 */
const startMetronome = async (): Promise<void> => {
	try {
		// Initialize audio if needed (only on user gesture)
		if (!audioState.audioInitialized) {
			await initAudio()
		}

		// Make sure audio context is running
		if (audioContext?.state !== "running") {
			await Tone.start()
		}

		// Stop any existing loop
		if (loop) {
			loop.stop().dispose()
		}

		// Create a new loop with current settings
		loop = createMetronomeLoop()

		// Set the tempo
		const transport = Tone.getTransport()
		transport.bpm.value = props.metronomeState.bpm

		// Start the loop and transport with the calculated delay
		loop.start(
			calculateSyncOffset(
				props.metronomeState.referenceTime,
				0,
				props.metronomeState.bpm,
				props.metronomeState.timeSignature.beatsPerMeasure,
				props.timingState.offset,
			),
		)
		transport.start()

		// Update playback state
		audioState.lastBpm = props.metronomeState.bpm
		audioState.lastTimeSignature = { ...props.metronomeState.timeSignature }
		audioState.lastIsPlaying = true
	} catch (error) {
		console.error("Error starting metronome:", error)
	}
}

/**
 * Stops the metronome playback
 */
const stopMetronome = (): void => {
	if (loop) {
		loop.stop()
	}

	const transport = Tone.getTransport()
	transport.stop()
	audioState.lastIsPlaying = false
}

/**
 * Updates the metronome when settings change
 */
const updateMetronome = async (): Promise<void> => {
	// If not playing, just update the stored values
	if (!props.metronomeState.isPlaying) {
		audioState.lastBpm = props.metronomeState.bpm
		audioState.lastTimeSignature = { ...props.metronomeState.timeSignature }
		return
	}

	// If already playing and settings changed, restart with new settings
	if (
		props.metronomeState.bpm !== audioState.lastBpm ||
		props.metronomeState.timeSignature.beatsPerMeasure !==
			audioState.lastTimeSignature.beatsPerMeasure ||
		props.metronomeState.timeSignature.beatUnit !==
			audioState.lastTimeSignature.beatUnit
	) {
		await startMetronome()
	}
}

// Clean up on component destroy
onDestroy(() => {
	// Stop and clean up loop
	if (loop) {
		loop.stop().dispose()
		loop = null
	}

	// Don't dispose synth to prevent memory leaks with rapid component re-renders
})

// Watch for state changes
$effect(() => {
	// Skip if user hasn't interacted yet
	if (!props.hasUserInteracted) return

	// Handle play/pause state changes
	if (props.metronomeState.isPlaying !== audioState.lastIsPlaying) {
		if (props.metronomeState.isPlaying) {
			startMetronome()
		} else {
			stopMetronome()
		}
	}
	// Handle other state changes while playing
	else if (props.metronomeState.isPlaying) {
		updateMetronome()
	}
})
</script>
