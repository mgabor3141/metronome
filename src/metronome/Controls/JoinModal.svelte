<script lang="ts">
import { LogIn } from "@lucide/svelte"

let modal: HTMLDialogElement
</script>

<button class="btn btn-sm btn-accent flex-1" onclick={() => modal.showModal()}
	><LogIn class="size-4" /> Join
</button>
<dialog bind:this={modal} class="modal">
	<div class="modal-box bg-base-200">
		<form class="flex flex-col items-center justify-center gap-4 text-center">
			<h2 class="text-2xl font-bold">Join a group</h2>
			<p>Enter the code shown on the other device</p>
			<input
				class="input mb-4 w-1/2 text-center"
				placeholder="Group Code"
				type="text"
				name="join"
				maxlength={4}
				oninput={(e) => {
					if (e.target instanceof HTMLInputElement) {
						e.target.value = e.target.value.toUpperCase()
					}
				}}
			/>
			<button type="submit" class="btn btn-sm btn-accent"
				><LogIn class="size-4" />Join</button
			>
		</form>
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
