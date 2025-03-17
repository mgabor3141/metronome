/**
 * Utility functions for group code generation and management
 */

const GROUP_CODE_KEY = "metronome-group-code"

/**
 * Generates a random 4-letter uppercase code
 */
export function generateGroupCode(): string {
	const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ" // Excluding I and O to avoid confusion
	let result = ""

	for (let i = 0; i < 4; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length))
	}

	return result
}

/**
 * Saves the group code to local storage
 */
export function saveGroupCode(code: string): void {
	localStorage.setItem(GROUP_CODE_KEY, code)
}

/**
 * Gets the group code from local storage
 */
export function getGroupCode(): string | null {
	return localStorage.getItem(GROUP_CODE_KEY)
}

/**
 * Checks if a group code exists in local storage
 */
export function hasGroupCode(): boolean {
	return !!getGroupCode()
}

/**
 * Clears the group code from local storage
 */
export function clearGroupCode(): void {
	localStorage.removeItem(GROUP_CODE_KEY)
}
