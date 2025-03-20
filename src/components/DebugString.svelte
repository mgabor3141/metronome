<script lang="ts">
const props = $props<unknown>()
</script>

<div class="m-1 text-xs text-gray-500 dark:text-gray-400">
	<pre class="w-fit text-left">{JSON.stringify(props, null, 2)}</pre>
	{#if Object.hasOwn(props, "children")}
		{@render props.children()}
	{/if}
</div>
