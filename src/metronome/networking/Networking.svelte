<script lang="ts">
import GroupProvider from "./providers/GroupProvider.svelte"
import PeerConnectionsProvider from "./providers/PeerConnectionsProvider.svelte"
import PeerProvider from "./providers/PeerProvider.svelte"
import TimeSync from "./TimeSync.svelte"

// biome-ignore lint/style/useConst: <explanation>
let { metronomeState = $bindable(), timingState = $bindable() } = $props()
</script>

<PeerProvider>
	<GroupProvider>
		<PeerConnectionsProvider>
			<p> Peer connections provider </p>
			<!-- <TimeSync bind:timingState /> -->
		</PeerConnectionsProvider>
	</GroupProvider>
</PeerProvider>
