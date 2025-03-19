/**
 * Timing utilities for metronome calculations
 */

/**
 * Calculate the reference time based on current playhead position
 * @param transportSeconds - Current playhead position in seconds
 * @param wallClockOffset - Offset between local and remote wall clocks in milliseconds (positive if remote is ahead)
 * @returns The calculated reference time in milliseconds
 */
export const getReferenceTime = (
	transportSeconds: number,
	wallClockOffset = 0,
): number => new Date().getTime() + wallClockOffset - transportSeconds * 1000

/**
 * Calculate the current playhead position based on a reference time
 *
 * This function answers: "Where should the playhead be now if we want to
 * start playback at the same position that the other client is playing at currently?"
 *
 * @param referenceTime - The reference time when playback started (in milliseconds)
 * @param bpm - Beats per minute
 * @param beatsPerMeasure - Number of beats per measure
 * @param wallClockOffset - Offset between local and remote wall clocks in milliseconds (positive if remote is ahead)
 * @returns The normalized playhead position (0-1) where the playback should be now
 */
export const getTransportSeconds = (
	referenceTime: number,
	measureLengthSeconds: number,
	wallClockOffset = 0,
): number => {
	// Calculate elapsed time since reference, adjusted for wall clock offset
	const currentTime = new Date().getTime() + wallClockOffset
	const timeSinceReferenceSeconds = (currentTime - referenceTime) / 1000

	const result = timeSinceReferenceSeconds % measureLengthSeconds
	const resultPositive = result < 0 ? result + measureLengthSeconds : result

	return resultPositive
}
