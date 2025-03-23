<script lang="ts">
import {
	ClockFading,
	ClockArrowUp,
	ClockArrowDown,
	UserPlus,
	Clock,
	UserRound,
	UserRoundPlus,
	DoorOpen,
	LogOut,
} from "@lucide/svelte"
// @ts-expect-error Incorrect types upsteream
import QrCode from "svelte-qrcode"

import { getClock } from "../providers/ClockProvider.svelte"
import { getGroup } from "../providers/GroupProvider.svelte"
import { getStatus } from "../providers/StatusProvider.svelte"
import { clearGroupCode } from "../../utils/code-utils"

const clockState = getClock()
const groupState = getGroup()
const status = getStatus()

let modal: HTMLDialogElement
</script>

<button
	class="btn btn-sm btn-accent min-w-48"
	onclick={() => modal.showModal()}
>
	{#if !groupState || groupState.members.length <= 1}
		<UserRoundPlus class="h-4 w-4" /> Connect another device
	{:else if clockState.syncing}
		<span class="loading loading-spinner loading-md"></span>
		<p>Syncing with leader...</p>
	{:else if groupState.isGroupLeader}
		<Clock class="h-4 w-4" /> Leader
	{:else}
		<UserRound class="h-4 w-4" /> Follower
	{/if}
</button>
<dialog bind:this={modal} class="modal">
	<div class="modal-box prose bg-base-200 text-center">
		{#if !groupState || !status.connected}
			<h2>Offline</h2>
		{:else}
			{#if groupState.members.length <= 1}
				<h2>Join with another device</h2>
			{:else if groupState.isGroupLeader}
				<h2 class="text-lg font-bold">Leader</h2>
				<p>
					This device plays an accurate metronome. Other devices are adjusting
					their playback to match this device.
				</p>
			{:else}
				<h2 class="text-lg font-bold">Follower</h2>
				<p>This device is adjusting its playback to match the leader.</p>
			{/if}
			<p>Scan the QR code with another device to join the group.</p>

			{@const url = `${window.location.origin}/?join=${groupState.groupCode}`}
			<div class="not-prose mx-auto mt-2 w-fit">
				<QrCode
					padding={0}
					value={url}
					background="oklch(19.314% 0.027 265.754)"
					color="oklch(84.153% 0.007 265.754)"
				/>
			</div>

			<a class="text-xs" href={url}>{url}</a>

			<p>Or enter this code on another device:</p>
			<div class="flex items-center justify-center gap-2">
				<code class="bg-base-100! p-2 text-4xl font-bold"
					>{groupState.groupCode}</code
				>
				<!-- Button to leave group -->
				<button
					class="btn btn-sm btn-circle btn-ghost"
					onclick={() => {
						clearGroupCode()
						window.location.reload()
					}}
				>
					<LogOut class="size-8" />
				</button>
			</div>

			<p>Enter the code here:</p>
			<input
				class="input w-1/2 text-center"
				placeholder="Group Code"
				type="text"
				onsubmit={() => {
					// Navigate to ?join
					window.location.href = `${window.location.origin}/?join=${groupState.groupCode}`
				}}
			/>
		{/if}
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2"
				>✕</button
			>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button>close</button>
	</form>
</dialog>
