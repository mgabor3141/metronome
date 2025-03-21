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
</script>

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
