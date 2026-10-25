<script module lang="ts">
  export type { Status } from './ui/StatusBadge.svelte';
</script>

<script lang="ts">
  // @mesaaberta/privy imports this path; the component is ui/StatusBadge.svelte.
  import StatusBadge from './ui/StatusBadge.svelte';
  import type { ComponentProps } from 'svelte';

  let props: ComponentProps<typeof StatusBadge> = $props();
</script>

<StatusBadge {...props} />
