<script lang="ts">
  // @mesaaberta/privy imports this path; the component is ui/Icon.svelte.
  import Icon from './ui/Icon.svelte';
  import type { ComponentProps } from 'svelte';

  let props: ComponentProps<typeof Icon> = $props();
</script>

<Icon {...props} />
