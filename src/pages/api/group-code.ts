/**
 * API endpoint for generating and registering group codes
 */
import type { APIRoute } from "astro"
import { generateGroupCode } from "../../utils/code-utils"

// Store registered group codes (would be lost on server restart)
const registeredCodes = new Set<string>()

/**
 * GET handler for generating a new group code
 */
export const GET: APIRoute = async () => {
	// Generate a unique group code
	let code = generateGroupCode()
	const maxAttempts = 10
	let attempts = 0
	
	// Ensure the code is unique
	while (registeredCodes.has(code) && attempts < maxAttempts) {
		code = generateGroupCode()
		attempts++
	}
	
	// Check if we found a unique code
	if (registeredCodes.has(code)) {
		return new Response(
			JSON.stringify({
				success: false,
				message: "Failed to generate a unique group code",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		)
	}
	
	// Register the code
	registeredCodes.add(code)
	console.log(`Generated new group code: ${code}`)
	
	// Return the code
	return new Response(
		JSON.stringify({
			success: true,
			code,
		}),
		{
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		},
	)
}

/**
 * POST handler for registering an existing group code
 */
export const POST: APIRoute = async ({ request }) => {
	try {
		// Parse the request body
		const body = await request.json()
		const { code } = body
		
		// Validate the code
		if (!code || typeof code !== "string" || code.length !== 4) {
			return new Response(
				JSON.stringify({
					success: false,
					message: "Invalid group code format",
				}),
				{
					status: 400,
					headers: {
						"Content-Type": "application/json",
					},
				},
			)
		}
		
		// Check if the code is already registered
		const isRegistered = registeredCodes.has(code)
		
		// Register the code if it's not already registered
		if (!isRegistered) {
			registeredCodes.add(code)
			console.log(`Registered existing group code: ${code}`)
		} else {
			console.log(`Group code already registered: ${code}`)
		}
		
		// Return success
		return new Response(
			JSON.stringify({
				success: true,
				isNewRegistration: !isRegistered,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			},
		)
	} catch (error) {
		console.error("Error registering group code:", error)
		
		// Return error
		return new Response(
			JSON.stringify({
				success: false,
				message: "Failed to register group code",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			},
		)
	}
}
