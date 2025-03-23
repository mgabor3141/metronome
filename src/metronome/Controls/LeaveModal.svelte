<script lang="ts">
import { clearGroupCode } from "../../utils/code-utils"

let modal: HTMLDialogElement
</script>

<button class="btn btn-sm btn-neutral flex-1" onclick={() => modal.showModal()}>
	Disconnect
</button>
<dialog bind:this={modal} class="modal">
	<div class="modal-box bg-base-200">
		<div class="flex flex-col justify-center gap-8 text-center">
			<h2 class="text-2xl font-bold">Disconnect</h2>
			<p>
				Are you sure you want to disconnect from this group and create a new
				group?
			</p>
			<div class="flex justify-center gap-2">
				<button
					class="btn btn-sm btn-accent"
					onclick={() => {
						clearGroupCode()
						window.location.reload()
					}}>Disconnect</button
				>
				<button
					class="btn btn-sm"
					onclick={() => {
						modal.close()
					}}>Cancel</button
				>
			</div>
		</div>

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
