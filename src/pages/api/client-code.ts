/**
 * API endpoint for client code generation and registration
 */
import type { APIRoute } from "astro"
import { generateRandomCode } from "../../utils/code-utils"

// Store active client codes (would be lost on server restart)
const activeCodes = new Set<string>()

interface CodeResponse {
  code: string
  success: boolean
  message?: string
}

/**
 * GET handler for generating a new client code
 */
export const GET: APIRoute = async () => {
  try {
    // Generate a unique code that doesn't collide with existing ones
    let newCode: string
    let attempts = 0
    const maxAttempts = 100 // Prevent infinite loops

    do {
      newCode = generateRandomCode()
      attempts++
    } while (activeCodes.has(newCode) && attempts < maxAttempts)

    if (attempts >= maxAttempts) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to generate a unique code after multiple attempts",
        } as CodeResponse),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Register the new code
    activeCodes.add(newCode)
    console.log(`Generated new client code: ${newCode}`)

    return new Response(
      JSON.stringify({
        code: newCode,
        success: true,
      } as CodeResponse),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    console.error("Error generating client code:", error)
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
      } as CodeResponse),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}

/**
 * POST handler for registering an existing client code
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { code } = body as { code: string }

    if (!code || typeof code !== "string" || code.length !== 4) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid client code format",
        } as CodeResponse),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Check if the code is already registered
    if (activeCodes.has(code)) {
      return new Response(
        JSON.stringify({
          code,
          success: true,
          message: "Code already registered",
        } as CodeResponse),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
    }

    // Register the code
    activeCodes.add(code)
    console.log(`Registered existing client code: ${code}`)

    return new Response(
      JSON.stringify({
        code,
        success: true,
      } as CodeResponse),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    console.error("Error registering client code:", error)
    return new Response(
      JSON.stringify({
        success: false,
        message: "Internal server error",
      } as CodeResponse),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
}
