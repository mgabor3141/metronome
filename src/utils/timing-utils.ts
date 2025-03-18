/**
 * Timing utilities for metronome calculations
 */

/**
 * Calculate the reference time based on current playhead position
 * @param playhead - Normalized playhead position (0-1) where 1 represents a full measure
 * @param wallClockOffset - Offset between local and remote wall clocks in milliseconds (positive if remote is ahead)
 * @returns The calculated reference time in milliseconds
 */
export const calculateReferenceTime = (
	playhead: number,
	wallClockOffset = 0,
): number => {
	return new Date().getTime() - playhead * 1000 - wallClockOffset
}

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
export const calculateSyncedPlayheadPosition = (
	referenceTime: number,
	measureLength: number,
	wallClockOffset = 0,
): number => {
	// Calculate elapsed time since reference, adjusted for wall clock offset
	const currentTime = new Date().getTime() - wallClockOffset
	const elapsedTimeSinceReference = (currentTime - referenceTime) / 1000

	const result = elapsedTimeSinceReference % measureLength
	const resultPositive = result < 0 ? measureLength + result : result

	console.log("currentTime", {
		currentTime,
		referenceTime,
		elapsedTimeSinceReference,
		measureLength,
		result,
	})

	return resultPositive
}
