/**
 * API endpoint for time synchronization using timesync
 */
import type { APIContext } from "astro"

export const POST = async (ctx: APIContext) => {
  try {
    // Get the request body
    const body = await ctx.request.json()
    
    // Process the timesync request
    // The timesync protocol expects a response with the same data plus a result field
    const result = {
      ...body,
      result: Date.now()
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json"
      }
    })
  } catch (error) {
    console.error("Error in timesync endpoint:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    })
  }
}
