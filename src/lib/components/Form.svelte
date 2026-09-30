<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLFormAttributes } from 'svelte/elements';
  let {
    children,
    method = 'POST',
    ...attributes
  }: HTMLFormAttributes & { children: Snippet } = $props();
</script>

<form {method} {...attributes}>
  {@render children()}
</form>
