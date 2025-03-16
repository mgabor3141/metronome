<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 */
import * as Tone from "tone"
import type { MetronomeState } from "./Metronome.svelte"
import { onDestroy } from "svelte"

interface MetronomeAudioProps {
	state: MetronomeState
	isPlaying: boolean
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
}

const audioState = $state<AudioState>({
	lastBpm: props.state.bpm,
	currentBeat: 0,
})

// References to Tone.js objects - defined outside of functions to persist between renders
let audioContext: AudioContext | null = null
let loop: Tone.Loop | null = null
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
const initAudio = () => {
	if (audioContext) return

	// Initialize audio context
	audioContext = Tone.getContext().rawContext as AudioContext
}

/**
 * Creates or updates the beat pattern based on current settings
 */
const updatePattern = (): void => {
	// Clean up existing pattern
	if (loop) {
		loop.dispose()
	}

	// Create new pattern
	loop = new Tone.Loop((time: number) => {
		if (audioState.currentBeat >= props.state.timeSignature.beatsPerMeasure) {
			audioState.currentBeat = 0
		}

		playBeat(time, { isAccented: audioState.currentBeat === 0 })
		audioState.currentBeat++
	}, `${props.state.timeSignature.beatUnit}n`)

	// Store the current BPM
	audioState.lastBpm = props.state.bpm

	loop.start(0)
}

/**
 * Starts the metronome playback
 * Only called after a user gesture (play button click)
 */
const startMetronome = async (): Promise<void> => {
	// Initialize audio if needed (only on user gesture)
	await initAudio()
	if (audioContext?.state !== "running") await Tone.start()

	// Create or update pattern if BPM changed or pattern doesn't exist
	if (!loop || props.state.bpm !== audioState.lastBpm) {
		updatePattern()
	}

	// Start the transport if not already running
	const transport = Tone.getTransport()
	if (transport.state !== "started") {
		// Reset to beginning of transport timeline
		transport.position = 0
		transport.start()
	}
}

/**
 * Stops the metronome playback
 */
const stopMetronome = (): void => {
	if (audioContext) Tone.getTransport().stop()
	audioState.currentBeat = 0
}

// Handle BPM and playback state changes
$effect(() => {
	if (!props.isPlaying) {
		stopMetronome()
		return
	}

	startMetronome()

	const newBpm = props.state.bpm

	// Smooth transition to new BPM
	Tone.getTransport().bpm.rampTo(newBpm, 0.2)

	// Update pattern with new timing
	updatePattern()
})

onDestroy(() => {
	stopMetronome()
	loop?.dispose()
})
</script>
