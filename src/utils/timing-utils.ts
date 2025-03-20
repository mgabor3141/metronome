import * as Tone from "tone"

/**
 * Returns the current time in milliseconds, accounting for the time origin and the audio context time
 * @returns The current time in milliseconds
 */
export const now = () => performance.timeOrigin + performance.now()

export const getTotalAudioLatency = () => {
	const audioLatencySeconds =
		// @ts-expect-error This property exists but is not typed in Tone.js
		(Tone.getContext().rawContext._nativeAudioContext.outputLatency || 0) +
		// @ts-expect-error This property exists but is not typed in Tone.js
		Tone.getContext().rawContext._nativeAudioContext.baseLatency

	return audioLatencySeconds
}

/**
 * Calculate the reference time based on current playhead position
 *
 * This function answers: "What's the exact timestamp of the first click?"
 *
 * @param transportSeconds - The current playhead position in seconds
 * @param wallClockOffset - The difference between local and remote clocks in milliseconds
 * @param optionalStartDelaySeconds - Optional delay in seconds to be added to the reference time
 * @returns The reference time in milliseconds
 */
export const getReferenceTime = (
	transportSeconds: number,
	wallClockOffset: number,
	optionalStartDelaySeconds = 0,
): number => {
	// Network synced wall clock time
	const currentTime = now() + wallClockOffset

	// Get output latency from native audio context in seconds
	const audioLatencySeconds = getTotalAudioLatency()

	// Calculate total scheduling offset in seconds
	const schedulingOffsetSeconds =
		-transportSeconds + audioLatencySeconds + optionalStartDelaySeconds

	// Beat will happen at current time + delays
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
	optionalStartDelaySeconds = 0,
): number => {
	// Network synced wall clock time
	const currentTime = now() + wallClockOffset

	// Accounting for network latency
	const timeSinceReferenceSeconds = (currentTime - referenceTime) / 1000
	const audioLatencySeconds = getTotalAudioLatency()

	// Tone.js scheduled lookahead
	const transportSeconds =
		timeSinceReferenceSeconds + audioLatencySeconds + optionalStartDelaySeconds

	// Modulo transportSeconds by measure length
	const transportSecondsModulo = transportSeconds % measureLengthSeconds

	// Ensure transportSeconds is positive
	const transportSecondsPositive =
		transportSecondsModulo < 0
			? transportSecondsModulo + measureLengthSeconds
			: transportSecondsModulo

	console.log("getTransportSeconds", {
		referenceTime,
		currentTime,
		timeSinceReferenceSeconds,
		measureLengthSeconds,
		wallClockOffset,
		transportSeconds,
		transportSecondsModulo,
		transportSecondsPositive,
		audioLatencySeconds,
	})

	return transportSecondsPositive
}
