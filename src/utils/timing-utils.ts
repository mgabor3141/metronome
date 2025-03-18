/**
 * Timing utilities for metronome calculations
 */

/**
 * Calculate the reference time based on current playhead position
 * @param playhead - Current playhead position from Tone.getTransport().immediate()
 * @param bpm - Beats per minute
 * @param beatsPerMeasure - Number of beats per measure
 * @returns The calculated reference time in milliseconds
 */
export const calculateReferenceTime = (
	playhead: number,
	bpm: number,
	beatsPerMeasure: number,
): number => {
	const beatLength = 60 / bpm
	const measureLength = beatLength * beatsPerMeasure
	const currentPosition = playhead % measureLength

	return new Date().getTime() - currentPosition * 1000
}

/**
 * Calculate the offset needed to sync with a provided reference time
 * @param referenceTime - The reference time to sync with (in milliseconds)
 * @param currentPlayhead - Current playhead position from Tone.getTransport().immediate()
 * @param bpm - Beats per minute
 * @param beatsPerMeasure - Number of beats per measure
 * @param wallClockOffset - Offset between local and remote wall clocks in milliseconds (positive if remote is ahead)
 * @returns The offset in seconds needed to sync with the reference time
 */
export const calculateSyncOffset = (
	referenceTime: number,
	currentPlayhead: number,
	bpm: number,
	beatsPerMeasure: number,
	wallClockOffset = 0,
): number => {
	// Calculate the beat and measure length in seconds
	const beatLength = 60 / bpm
	const measureLength = beatLength * beatsPerMeasure

	// Calculate where we are in the current measure
	const currentPositionInMeasure = currentPlayhead % measureLength

	// Calculate where we should be based on the reference time
	// Adjust the current time by the wall clock offset
	const currentTime = new Date().getTime() - wallClockOffset
	const elapsedTimeSinceReference = (currentTime - referenceTime) / 1000
	const targetPositionInMeasure = elapsedTimeSinceReference % measureLength

	// Calculate the offset (how much we need to adjust)
	return targetPositionInMeasure - currentPositionInMeasure
}
