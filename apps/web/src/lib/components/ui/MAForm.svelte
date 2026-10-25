<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLFormAttributes } from 'svelte/elements';
  let {
    children,
    element = $bindable(),
    method = 'POST',
    ...attributes
  }: HTMLFormAttributes & { children: Snippet; element?: HTMLFormElement } = $props();
</script>

<form bind:this={element} {method} {...attributes}>
  {@render children()}
</form>
