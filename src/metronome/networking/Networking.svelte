<script lang="ts">
import GroupProvider from "./providers/GroupProvider.svelte"
import PeerConnectionsProvider from "./providers/PeerConnectionsProvider.svelte"
import PeerProvider from "./providers/PeerProvider.svelte"
import TimeSync from "./TimeSync.svelte"
import MetronomeStateSync from "./MetronomeStateSync.svelte"

// biome-ignore lint/style/useConst: <explanation>
let { metronomeState = $bindable(), timingState = $bindable() } = $props()
</script>

<PeerProvider>
	<GroupProvider>
		<PeerConnectionsProvider>
			<TimeSync bind:timingState />
			<MetronomeStateSync bind:metronomeState />
		</PeerConnectionsProvider>
	</GroupProvider>
</PeerProvider>
