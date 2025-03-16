/**
 * API endpoint for generating and registering client codes
 */
import type { APIRoute } from "astro"
import { generateClientCode } from "../../utils/code-utils"

// Store registered client codes (would be lost on server restart)
const registeredCodes = new Set<string>()

/**
 * GET handler for generating a new client code
 */
export const GET: APIRoute = async () => {
	// Generate a unique client code
	let code = generateClientCode()
	const maxAttempts = 10
	let attempts = 0
	
	// Ensure the code is unique
	while (registeredCodes.has(code) && attempts < maxAttempts) {
		code = generateClientCode()
		attempts++
	}
	
	// Check if we found a unique code
	if (registeredCodes.has(code)) {
		return new Response(
			JSON.stringify({
				success: false,
				message: "Failed to generate a unique client code",
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
	console.log(`Generated new client code: ${code}`)
	
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
 * POST handler for registering an existing client code
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
					message: "Invalid client code format",
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
			console.log(`Registered existing client code: ${code}`)
		} else {
			console.log(`Client code already registered: ${code}`)
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
		console.error("Error registering client code:", error)
		
		// Return error
		return new Response(
			JSON.stringify({
				success: false,
				message: "Failed to register client code",
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
