import * as Tone from "tone"

/**
 * @returns The total audio latency in seconds
 */
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
 * @param optionalStartDelaySeconds - Optional delay in seconds to be added to the reference time
 * @returns The reference time in milliseconds
 */
export const getReferenceTime = ({
	currentTime,
	transportSeconds,
	optionalStartDelaySeconds = 0,
}: {
	currentTime: number
	transportSeconds: number
	optionalStartDelaySeconds?: number
}): number => {
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
 * @param currentTime - The current time in milliseconds
 * @param referenceTime - The reference time when playback started (in milliseconds)
 * @param measureLengthSeconds - Length of a measure in seconds
 * @param optionalStartDelaySeconds - Optional delay in seconds to be added to the reference time
 * @returns The playhead position in seconds
 */
export const getTransportPositionSeconds = ({
	currentTime,
	referenceTime,
	measureLengthSeconds,
	optionalStartDelaySeconds = 0,
}: {
	currentTime: number
	referenceTime: number
	measureLengthSeconds: number
	optionalStartDelaySeconds?: number
}): number => {
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

	return transportSecondsPositive
}
