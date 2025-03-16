/**
 * Utility functions for client code generation and management
 */

const CLIENT_CODE_KEY = "metronome-client-code"
const CLIENT_ID_KEY = "metronome-client-id"

/**
 * Generates a random 4-letter uppercase code
 */
export function generateClientCode(): string {
	const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ" // Excluding I and O to avoid confusion
	let result = ""
	
	for (let i = 0; i < 4; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length))
	}
	
	return result
}

/**
 * Generates a random UUID for client identification
 */
export function generateClientId(): string {
	return crypto.randomUUID()
}

/**
 * Saves the client code to local storage
 */
export function saveClientCode(code: string): void {
	localStorage.setItem(CLIENT_CODE_KEY, code)
}

/**
 * Saves the client ID to local storage
 */
export function saveClientId(id: string): void {
	localStorage.setItem(CLIENT_ID_KEY, id)
}

/**
 * Gets the client code from local storage
 */
export function getClientCode(): string | null {
	return localStorage.getItem(CLIENT_CODE_KEY)
}

/**
 * Gets the client ID from local storage
 */
export function getClientId(): string | null {
	return localStorage.getItem(CLIENT_ID_KEY)
}

/**
 * Checks if a client code exists in local storage
 */
export function hasClientCode(): boolean {
	return !!getClientCode()
}

/**
 * Checks if a client ID exists in local storage
 */
export function hasClientId(): boolean {
	return !!getClientId()
}

/**
 * Clears the client code from local storage
 */
export function clearClientCode(): void {
	localStorage.removeItem(CLIENT_CODE_KEY)
}

/**
 * Clears the client ID from local storage
 */
export function clearClientId(): void {
	localStorage.removeItem(CLIENT_ID_KEY)
}
