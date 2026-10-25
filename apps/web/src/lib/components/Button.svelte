<script module lang="ts">
  export { buttonClass, type ButtonSize, type ButtonVariant } from './ui/MAButton.svelte';
</script>

<script lang="ts">
  // @mesaaberta/privy imports this path; the component is ui/MAButton.svelte.
  import MAButton from './ui/MAButton.svelte';
  import type { ComponentProps } from 'svelte';

  let props: ComponentProps<typeof MAButton> = $props();
</script>

<MAButton {...props} />
