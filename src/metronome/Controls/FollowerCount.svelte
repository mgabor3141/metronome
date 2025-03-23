<script lang="ts">
import { UserRound } from "@lucide/svelte"
import { getGroup } from "../providers/GroupProvider.svelte"
import NumberFlow from "@number-flow/svelte"

const groupState = getGroup()
const connectedFollowers = $derived(groupState.members.length - 1)
</script>

<div class="tooltip tooltip-right" data-tip={`${connectedFollowers} connected`}>
	<div class="flex items-center gap-2">
		<UserRound class="size-4" />
		<NumberFlow
			class={[
				"transition-opacity",
				{ "opacity-0": groupState.members.length <= 1 },
			]}
			value={connectedFollowers}
		/>
	</div>
</div>
