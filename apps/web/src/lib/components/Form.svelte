<script lang="ts">
  // @mesaaberta/privy imports this path; the component is ui/MAForm.svelte.
  import MAForm from './ui/MAForm.svelte';
  import type { ComponentProps } from 'svelte';

  let props: ComponentProps<typeof MAForm> = $props();
</script>

<MAForm {...props} />
