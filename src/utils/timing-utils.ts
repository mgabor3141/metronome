import * as Tone from "tone"

/**
 * Returns the current time in milliseconds, accounting for the time origin and the audio context time
 * @returns The current time in milliseconds
 */
export const now = () =>
	performance.timeOrigin +
	// @ts-expect-error I promise you that this exists, I'm going to use it
	Tone.getContext().rawContext._nativeAudioContext.getOutputTimestamp()
		.performanceTime

/**
 * Calculate the reference time based on current playhead position
 *
 * This function answers: "What's the exact timestamp of the first click?"
 *
 * @param transportSeconds - The current playhead position in seconds
 * @param wallClockOffset - The difference between local and remote clocks in milliseconds
 * @returns The reference time in milliseconds
 */
export const getReferenceTime = (
	transportSeconds: number,
	wallClockOffset: number,
): number => {
	// Network synced wall clock time
	const currentTime = now() + wallClockOffset

	// Get audio context look-ahead time in seconds
	const lookAheadSeconds = Tone.getContext().lookAhead

	// Get output latency from native audio context in seconds
	const audioLatencySeconds =
		// @ts-expect-error This property exists but is not typed in Tone.js
		Tone.getContext().rawContext._nativeAudioContext.outputLatency

	// Calculate total scheduling offset in seconds
	const schedulingOffsetSeconds =
		transportSeconds + lookAheadSeconds + audioLatencySeconds

	// Calculate and return the final reference time in milliseconds
	return currentTime + schedulingOffsetSeconds * 1000
}

/**
 * Calculate the current playhead position based on a reference time
 *
 * This function answers: "Where should the playhead be now if we want to
 * have the first click at the reference timestamp?"
 *
 * @param referenceTime - The reference time when playback started (in milliseconds)
 * @param bpm - Beats per minute
 * @param beatsPerMeasure - Number of beats per measure
 * @param wallClockOffset - Offset between local and remote wall clocks in milliseconds (positive if remote is ahead)
 * @returns The playhead position in seconds
 */
export const getTransportPositionSeconds = (
	referenceTime: number,
	measureLengthSeconds: number,
	wallClockOffset: number,
	optionalStartDelay = 0,
): number => {
	// Network synced wall clock time
	const currentTime = now() + wallClockOffset

	// Accounting for network latency
	const timeSinceReferenceSeconds = (currentTime - referenceTime) / 1000
	const audioLatencySeconds =
		// @ts-expect-error This property exists but is not typed in Tone.js
		Tone.getContext().rawContext._nativeAudioContext.outputLatency

	// Tone.js scheduled lookahead
	const lookaheadSeconds = Tone.getContext().lookAhead

	const transportSeconds =
		timeSinceReferenceSeconds -
		lookaheadSeconds -
		audioLatencySeconds -
		optionalStartDelay

	// Modulo transportSeconds by measure length
	const transportSecondsModulo = transportSeconds % measureLengthSeconds

	// Ensure transportSeconds is positive
	const transportSecondsPositive =
		transportSecondsModulo < 0
			? transportSecondsModulo + measureLengthSeconds
			: transportSecondsModulo

	console.log("getTransportSeconds", {
		currentTime,
		timeSinceReferenceSeconds,
		measureLengthSeconds,
		wallClockOffset,
		lookaheadSeconds,
		transportSeconds,
		transportSecondsModulo,
		transportSecondsPositive,
		audioLatencySeconds,
	})

	return transportSecondsPositive
}
