// @ts-check
import { defineConfig } from "astro/config"

import svelte from "@astrojs/svelte"
import tailwindcss from "@tailwindcss/vite"
import websocket from "astro-bun-websocket"

// https://astro.build/config
export default defineConfig({
	integrations: [svelte()],

	vite: {
		plugins: [tailwindcss()],
	},

	// Server configuration for WebSocket support
	server: {
		host: true, // Allow connections from network
		port: 4321, // Default port
		headers: {
			// Required for high resolution time
			// See: https://developer.mozilla.org/en-US/docs/Web/API/DOMHighResTimeStamp
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},

	// Use astro-bun-websocket as the adapter
	adapter: websocket(),

	// Enable server endpoints for API routes
	output: "server",
})
