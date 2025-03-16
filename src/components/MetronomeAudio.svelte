<script lang="ts">
/**
 * MetronomeAudio component that handles audio playback using Tone.js
 * This component is responsible for accurate timing and sound generation
 */
import * as Tone from "tone"
import { onMount, onDestroy } from "svelte"
import type { MetronomeState } from "./Metronome.svelte"

// Props interface for the component
interface MetronomeAudioProps {
	// Full state object
	state: MetronomeState
	// Playing state
	isPlaying: boolean
}

// Receive props from parent component
const props: MetronomeAudioProps = $props()

// Audio state
const audioState = $state({
	initialized: false,
	currentBeat: 0,
})

// Store Tone.js context reference
let audioContext: AudioContext | null = null

// Derived values for timing calculations
const beatDurationMs = $derived(60000 / props.state.bpm)
const beatDurationSeconds = $derived(beatDurationMs / 1000)

/**
 * Creates a new synth for a single sound and then disposes it
 * This avoids the "Start time must be strictly greater than previous start time" error
 */
const playOneShot = (note: string, velocity: number): void => {
	try {
		console.log(`Playing one-shot sound: ${note}`)
		// Create a new synth for this sound only
		const oneShot = new Tone.Synth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.1 },
			volume: -6
		}).toDestination()
		
		// Play the sound
		oneShot.triggerAttackRelease(note, "16n", undefined, velocity)
		
		// Dispose after sound is complete
		setTimeout(() => {
			oneShot.dispose()
		}, 500)
	} catch (error) {
		console.error("Error playing one-shot sound:", error)
	}
}

// Function to play a beat
const playBeat = (time: number): void => {
	// Log each beat for debugging
	console.log(`Beat: ${audioState.currentBeat + 1}/${props.state.timeSignature.beatsPerMeasure}, time: ${time.toFixed(3)}`)
	
	// Play different pitches for accented (first) beat vs regular beats
	const isAccentedBeat = audioState.currentBeat === 0
	const note = isAccentedBeat ? "C5" : "G4"
	const velocity = isAccentedBeat ? 0.7 : 0.5
	
	// Create a new synth for each beat
	try {
		// Create a new synth for this beat
		const beatSynth = new Tone.Synth({
			oscillator: { type: "triangle" },
			envelope: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.1 },
			volume: -6
		}).toDestination()
		
		// Play the sound
		beatSynth.triggerAttackRelease(note, "16n", time, velocity)
		
		// Dispose after sound is complete
		setTimeout(() => {
			beatSynth.dispose()
		}, 500)
	} catch (error) {
		console.error("Error triggering beat sound:", error)
	}
	
	// Update beat counter
	audioState.currentBeat = (audioState.currentBeat + 1) % props.state.timeSignature.beatsPerMeasure
}

// Initialize Tone.js and audio components
const initAudio = async (): Promise<void> => {
	console.log("Initializing audio...")
	
	if (audioState.initialized) {
		console.log("Audio already initialized, skipping")
		return
	}

	try {
		// Initialize Tone.js context - this requires a user gesture
		console.log("Starting Tone.js context...")
		await Tone.start()
		console.log("Tone.js context started successfully")
		
		// Store reference to the audio context
		audioContext = Tone.getContext().rawContext as AudioContext
		
		// Play a test sound to verify audio is working
		playOneShot("C4", 0.5)
		
		// Set up Tone.Transport
		console.log("Setting up Tone.Transport...")
		Tone.Transport.bpm.value = props.state.bpm
		
		audioState.initialized = true
		console.log("Audio initialization complete")
	} catch (error) {
		console.error("Failed to initialize audio:", error)
	}
}

// Schedule the repeating event
let repeatId: number | null = null;

// Start the metronome
const startMetronome = async (): Promise<void> => {
	console.log("Starting metronome, isPlaying:", props.isPlaying)
	
	// Only initialize audio on first play (user gesture)
	if (!audioState.initialized) {
		console.log("Audio not initialized, initializing now...")
		await initAudio()
	}
	
	// If initialization failed, exit early
	if (!audioState.initialized) {
		console.error("Cannot start metronome: audio not initialized")
		return
	}
	
	// Reset beat counter
	audioState.currentBeat = 0
	
	// Update BPM
	Tone.Transport.bpm.value = props.state.bpm
	
	// Play a test sound immediately to confirm audio is working
	playOneShot("G4", 0.5)
	
	// Resume audio context if it was suspended
	if (audioContext?.state === "suspended") {
		console.log("Resuming audio context...")
		await audioContext.resume()
	}
	
	// Schedule the repeating event if not already scheduled
	if (repeatId === null) {
		console.log("Scheduling repeating event...")
		repeatId = Tone.Transport.scheduleRepeat((time) => {
			playBeat(time);
		}, `${beatDurationSeconds}`, "+0.1");
		
		console.log("Repeat scheduled with ID:", repeatId)
	}
	
	// Start the transport if it's not already running
	if (Tone.Transport.state !== "started") {
		console.log("Starting Tone.Transport...")
		Tone.Transport.start("+0.1")
		console.log("Tone.Transport started, state:", Tone.Transport.state)
	} else {
		console.log("Tone.Transport already running, state:", Tone.Transport.state)
	}
}

// Stop the metronome
const stopMetronome = (): void => {
	console.log("Stopping metronome")
	
	if (audioState.initialized) {
		// Clear the scheduled repeat
		if (repeatId !== null) {
			console.log("Clearing scheduled repeat:", repeatId)
			Tone.Transport.clear(repeatId)
			repeatId = null
		}
		
		// Stop transport
		if (Tone.Transport.state === "started") {
			console.log("Stopping Tone.Transport...")
			Tone.Transport.stop()
			console.log("Tone.Transport stopped, state:", Tone.Transport.state)
		}
		
		// Reset beat counter
		audioState.currentBeat = 0
	} else {
		console.log("Cannot stop: audio not initialized")
	}
}

// Update BPM when it changes
$effect(() => {
	console.log("BPM changed to:", props.state.bpm)
	if (audioState.initialized) {
		console.log("Updating Tone.Transport BPM...")
		Tone.Transport.bpm.value = props.state.bpm
		console.log("Tone.Transport BPM updated")
	}
})

// Start or stop the metronome based on isPlaying prop
$effect(() => {
	console.log("isPlaying changed:", props.isPlaying)
	if (props.isPlaying) {
		startMetronome()
	} else {
		stopMetronome()
	}
})

// Clean up resources when component is destroyed
onDestroy(() => {
	console.log("Cleaning up audio resources...")
	if (audioState.initialized) {
		stopMetronome()
		
		// Clear any remaining scheduled events
		Tone.Transport.cancel()
		
		audioState.initialized = false
	}
	console.log("Cleanup complete")
})
</script>
