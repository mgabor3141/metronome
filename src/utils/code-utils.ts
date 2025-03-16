/**
 * Utilities for client code generation and management
 */

/**
 * Generates a random 4-letter uppercase code
 * @returns A random 4-letter uppercase code
 */
export function generateRandomCode(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    code += letters[randomIndex];
  }
  
  return code;
}

/**
 * Saves the client code to local storage
 * @param code - The client code to save
 */
export function saveClientCode(code: string): void {
  localStorage.setItem("metronome-client-code", code);
}

/**
 * Retrieves the client code from local storage
 * @returns The client code if it exists, null otherwise
 */
export function getClientCode(): string | null {
  return localStorage.getItem("metronome-client-code");
}

/**
 * Checks if a client code already exists in local storage
 * @returns True if a client code exists, false otherwise
 */
export function hasClientCode(): boolean {
  return getClientCode() !== null;
}
