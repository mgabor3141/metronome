<script lang="ts">
const props = $props()
</script>

<div class="text-xs text-gray-500 dark:text-gray-400 m-1">
    <pre class="text-left w-fit">{JSON.stringify(props, null, 2)}</pre>
    {@render props.children?.()}
</div>