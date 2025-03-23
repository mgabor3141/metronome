<script lang="ts">
import GroupProvider from "./providers/GroupProvider.svelte"
import PeerConnectionsProvider from "./providers/PeerConnectionsProvider.svelte"
import MetronomeStateProvider from "./providers/MetronomeStateProvider.svelte"
import ClockProvider from "./providers/ClockProvider.svelte"
import MetronomeStateSync from "./MetronomeStateSync.svelte"
import PeerProvider from "./providers/PeerProvider.svelte"
import Audio from "./Audio.svelte"
import Controls from "./Controls/Controls.svelte"
import Loading from "./Loading.svelte"
import StatusProvider from "./providers/StatusProvider.svelte"

let error: string | undefined = $state()
</script>

<svelte:window
	onerror={(e) => (error = (e as unknown as ErrorEvent).message)}
/>

{#if error}
	<div
		class="mx-auto my-64 flex max-w-md flex-col items-center gap-2 text-center"
	>
		<p>An error occurred:</p>
		<pre>{error}</pre>
		<button class="btn" onclick={() => window.location.reload()}>Refresh</button
		>
	</div>
{:else}
	<StatusProvider>
		<PeerProvider>
			<GroupProvider>
				<PeerConnectionsProvider>
					<MetronomeStateProvider>
						<MetronomeStateSync />
						<ClockProvider>
							<Loading>
								<Controls />
								<Audio />
							</Loading>
						</ClockProvider>
					</MetronomeStateProvider>
				</PeerConnectionsProvider>
			</GroupProvider>
		</PeerProvider>
	</StatusProvider>
{/if}
