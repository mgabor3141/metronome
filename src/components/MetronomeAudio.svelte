<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 */
import * as Tone from "tone"
import type { MetronomeState } from "./Metronome.svelte"
import { onDestroy } from "svelte"
import * as TimeSync from "../utils/time-sync"

interface MetronomeAudioProps {
	state: MetronomeState
	hasUserInteracted: boolean
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
	syncOffset: number
	isSyncInitialized: boolean
	lastStartTime: number
}

const audioState = $state<AudioState>({
	lastBpm: props.state.bpm,
	currentBeat: 0,
	syncOffset: 0,
	isSyncInitialized: false,
	lastStartTime: 0
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
const initAudio = async (): Promise<void> => {
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
 * Calculates the synchronized start position to align with other clients
 */
const calculateSyncedStartPosition = async (): Promise<{ delaySeconds: number; startBeat: number }> => {
	// Wait for time sync to be initialized
	if (!audioState.isSyncInitialized) {
		try {
			await TimeSync.initialize()
			audioState.isSyncInitialized = true
		} catch (error) {
			console.error("Failed to initialize TimeSync:", error)
			// We'll throw an error if we can't get synchronized time
			throw new Error("Time synchronization failed")
		}
	}
	
	// Get the synchronized time and offset
	const timeOffset = TimeSync.getOffset()
	audioState.syncOffset = timeOffset
	
	try {
		// Calculate the next beat time
		const { nextBeatTime, beatNumber } = TimeSync.calculateNextBeatTime(
			props.state.bpm,
			props.state.timeSignature.beatsPerMeasure
		)
		
		// Calculate how many seconds until the next beat
		const syncedTime = TimeSync.getSyncedTime()
		const timeUntilNextBeat = (nextBeatTime - syncedTime) / 1000
		
		// Store the start time for debugging
		audioState.lastStartTime = nextBeatTime
		
		console.log(`Time sync: offset=${timeOffset}ms, next beat in ${timeUntilNextBeat.toFixed(3)}s, beat ${beatNumber}`)
		
		return {
			delaySeconds: timeUntilNextBeat,
			startBeat: beatNumber
		}
	} catch (error) {
		console.error("Error calculating next beat time:", error)
		throw new Error("Failed to calculate synchronized start time")
	}
}

/**
 * Starts the metronome playback
 * Only called after a user gesture (play button click)
 */
const startMetronome = async (): Promise<void> => {
	// Initialize audio if needed (only on user gesture)
	await initAudio()
	if (audioContext?.state !== "running") await Tone.start()
	
	// Ensure TimeSync is initialized before proceeding
	if (!audioState.isSyncInitialized) {
		try {
			await TimeSync.initialize()
			audioState.isSyncInitialized = true
		} catch (error) {
			console.error("Failed to initialize TimeSync:", error)
			// Cannot continue without time sync
			return
		}
	}

	// Create or update pattern if BPM changed or pattern doesn't exist
	if (!loop || props.state.bpm !== audioState.lastBpm) {
		updatePattern()
	}

	try {
		// Calculate synchronized start position
		const { delaySeconds, startBeat } = await calculateSyncedStartPosition()
		
		// Reset the current beat to match the synchronized beat
		audioState.currentBeat = startBeat
		
		// Start the transport if not already running
		const transport = Tone.getTransport()
		if (transport.state !== "started") {
			// Reset to beginning of transport timeline
			transport.position = 0
			
			// Start with a delay to synchronize with other clients
			transport.start(`+${delaySeconds}`)
		}
	} catch (error) {
		console.error("Failed to start metronome with synchronization:", error)
		// Fall back to starting without synchronization
		const transport = Tone.getTransport()
		if (transport.state !== "started") {
			transport.position = 0
			transport.start()
		}
	}
}

/**
 * Stops the metronome playback
 */
const stopMetronome = (): void => {
	if (audioContext) Tone.getTransport().stop()
	audioState.currentBeat = 0
}

// Check if TimeSync is already initialized
$effect(() => {
	TimeSync.isInitialized.subscribe(value => {
		audioState.isSyncInitialized = value
	})
})

// Handle BPM and playback state changes
$effect(() => {
	if (!(props.state.isPlaying && props.hasUserInteracted)) {
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
