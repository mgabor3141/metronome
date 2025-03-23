<script lang="ts">
import { getMetronomeState } from "./providers/MetronomeStateProvider.svelte"
import { getClock } from "./providers/ClockProvider.svelte"
import DebugInfo from "./Controls/DebugInfo.svelte"

const metronomeState = getMetronomeState()
const clock = getClock()

const { children } = $props()
</script>

{#if !metronomeState?.bpm || !clock.synced}
	<div class="flex h-[100dvh] flex-col justify-between gap-4 p-8">
		<div></div>
		<p class="flex items-center justify-center gap-3">
			<span class="loading loading-spinner loading-lg"></span>
			Synchronizing...
		</p>
		<div class="flex justify-center">
			<DebugInfo />
		</div>
	</div>
{:else}
	{@render children()}
{/if}
