<script lang="ts">
import { getMetronomeState } from "./providers/MetronomeStateProvider.svelte"
import { getClock } from "./providers/ClockProvider.svelte"

const metronomeState = getMetronomeState()
const clock = getClock()

const { children } = $props()
</script>

{#if !metronomeState?.bpm || !clock.synced}
	<p class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
		Synchronizing...
	</p>
{:else}
	{@render children()}
{/if}
