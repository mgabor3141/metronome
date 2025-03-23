<script lang="ts">
import { getGroup } from "../providers/GroupProvider.svelte"
// @ts-expect-error Incorrect types upstream
import QrCode from "svelte-qrcode"

const groupState = getGroup()

const url = `${window.location.origin}/?join=${groupState.groupCode}`
</script>

<div class="prose mx-auto flex flex-col items-center gap-4 text-center">
	<div class="flex flex-col items-center">
		<span>Join with Code</span>
		<code class="bg-base-200 p-1 text-3xl font-bold"
			>{groupState.groupCode}</code
		>
		<div class="not-prose mx-auto mt-2 w-fit">
			<QrCode
				size={128}
				value={url}
				background="oklch(17.86% 0.024 265.754)"
				color="oklch(84.153% 0.007 265.754)"
			/>
		</div>

		<a class="text-xs opacity-50" href={url}>{url}</a>
	</div>
</div>
