<script lang="ts" module>
import { getContext } from "svelte"

const STATUS_CONTEXT_KEY = Symbol("status")

export type TriState = true | false | undefined

export class Status {
	peerConnected = $state<TriState>(undefined)
	serverConnected = $state<TriState>(undefined)
	connected = $derived.by(() => {
		if (this.serverConnected === undefined || this.peerConnected === undefined)
			return undefined

		return this.serverConnected && this.peerConnected
	})

	hasUserInteracted = $state(false)
}

export const getStatus = () => getContext<Status>(STATUS_CONTEXT_KEY)
</script>

<script lang="ts">
import { setContext } from "svelte"

const status = new Status()

setContext(STATUS_CONTEXT_KEY, status)

const { children } = $props()
</script>

{@render children()}
