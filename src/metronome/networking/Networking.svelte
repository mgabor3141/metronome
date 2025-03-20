<script lang="ts">
import GroupProvider from "./providers/GroupProvider.svelte"
import PeerConnectionsProvider from "./providers/PeerConnectionsProvider.svelte"
import PeerProvider from "./providers/PeerProvider.svelte"
import TimeSync from "./TimeSync.svelte"
import MetronomeStateSync from "./MetronomeStateSync.svelte"
import RequestInitialState from "./RequestInitialState.svelte"

let {
	metronomeState = $bindable(),
	timingState = $bindable(),
	waitingForInitialState = $bindable(),
} = $props()
</script>

<PeerProvider>
	<GroupProvider>
		<PeerConnectionsProvider>
			<RequestInitialState {metronomeState} {waitingForInitialState} />
			<TimeSync bind:timingState />
			<MetronomeStateSync bind:metronomeState bind:waitingForInitialState />
		</PeerConnectionsProvider>
	</GroupProvider>
</PeerProvider>
