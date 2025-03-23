<script lang="ts">
import { getMetronomeState } from "./providers/MetronomeStateProvider.svelte"
import { getClock } from "./providers/ClockProvider.svelte"

const metronomeState = getMetronomeState()
const clock = getClock()

const { children } = $props()
</script>

{#if !metronomeState?.bpm || !clock.synced}
	<div class="flex h-[100vh] flex-col justify-center">
		<p class="flex items-center justify-center gap-3">
			<span class="loading loading-spinner loading-lg"></span>
			Synchronizing...
		</p>
	</div>
{:else}
	{@render children()}
{/if}
