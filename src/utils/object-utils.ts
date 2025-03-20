/**
 * Utility functions for object operations
 */

/**
 * Type for representing a deeply partial object
 */
export type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>
		}
	: T

/**
 * Performs a deep equality check between two objects
 *
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @returns True if objects are deeply equal, false otherwise
 */
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
	// If both are primitive values or one of them is null/undefined
	if (obj1 === obj2) return true
	if (obj1 === null || obj2 === null) return false
	if (obj1 === undefined || obj2 === undefined) return false
	if (typeof obj1 !== "object" || typeof obj2 !== "object") return false

	// Handle arrays
	if (Array.isArray(obj1) && Array.isArray(obj2)) {
		if (obj1.length !== obj2.length) return false
		return obj1.every((val, idx) => deepEqual(val, obj2[idx]))
	}

	// If one is array but other is not
	if (Array.isArray(obj1) !== Array.isArray(obj2)) return false

	// Compare object keys
	const keys1 = Object.keys(obj1)
	const keys2 = Object.keys(obj2)

	if (keys1.length !== keys2.length) return false

	return keys1.every((key) => {
		return (
			Object.prototype.hasOwnProperty.call(obj2, key) &&
			deepEqual(
				(obj1 as Record<string, unknown>)[key],
				(obj2 as Record<string, unknown>)[key],
			)
		)
	})
}

/**
 * Creates a deep copy of an object with type safety
 */
function deepCopy<T>(obj: T): T {
	if (obj === null || typeof obj !== "object") {
		return obj
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => deepCopy(item)) as unknown as T
	}

	const result = {} as T
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			result[key] = deepCopy(obj[key])
		}
	}

	return result
}

/**
 * Performs a deep merge of objects and returns a new object only if there are actual changes
 * If no changes are detected, returns the original target object
 *
 * @param target - The target object to merge into
 * @param source - The source object to merge from
 * @returns A new object if changes were made, otherwise the original target
 */
export function deepMergeIfChanged<T>(target: T, source?: DeepPartial<T>): T {
	// If source is undefined or null, return the target unchanged
	if (!source) {
		return target
	}

	// Create a deep copy to work with
	const result = deepCopy(target)
	let hasChanges = false

	// Process each property in source
	for (const key in source) {
		if (Object.prototype.hasOwnProperty.call(source, key)) {
			const sourceValue = source[key]

			// Skip undefined values
			if (sourceValue === undefined) {
				continue
			}

			const targetValue = target[key as keyof T]

			// Handle nested objects
			if (
				sourceValue !== null &&
				targetValue !== null &&
				typeof sourceValue === "object" &&
				typeof targetValue === "object" &&
				!Array.isArray(sourceValue) &&
				!Array.isArray(targetValue)
			) {
				// Recursively merge nested objects
				const mergedValue = deepMergeIfChanged(
					targetValue,
					sourceValue as DeepPartial<typeof targetValue>,
				)

				// Only update if there were changes
				if (mergedValue !== targetValue) {
					;(result as Record<string, unknown>)[key] = mergedValue
					hasChanges = true
				}
			}
			// Handle primitive values and arrays
			else if (!deepEqual(sourceValue, targetValue)) {
				;(result as Record<string, unknown>)[key] = sourceValue
				hasChanges = true
			}
		}
	}

	return hasChanges ? result : target
}
