<script lang="ts">
/**
 * TimeSyncProvider component
 * Provides time synchronization context to child components using PeerJS
 */
import { onDestroy } from "svelte"
import { cleanupPeer, getTimeSyncContext, initializePeer } from "./time-sync"

const { children } = $props()

// Initialize PeerJS connection automatically
void initializePeer()

const timeSync = getTimeSyncContext()

// Clean up on component destroy
onDestroy(() => {
	cleanupPeer()
})
</script>

{#if timeSync.peerId}
	{@render children?.()}
{:else}
	<div class="flex items-center justify-center p-4">
		<div class="text-center">
			<div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">Initializing connection...</p>
		</div>
	</div>
{/if}
