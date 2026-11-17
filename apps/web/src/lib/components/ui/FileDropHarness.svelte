<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import FileDrop from './FileDrop.svelte';

  // FileDrop inside a form, for the spec that resets it.
  let props: ComponentProps<typeof FileDrop> = $props();
</script>

<form><FileDrop {...props} /></form>
