<script lang="ts">
  // @mesaaberta/privy imports this path; the component is ui/TextInput.svelte.
  import TextInput from './ui/TextInput.svelte';
  import type { ComponentProps } from 'svelte';

  let props: ComponentProps<typeof TextInput> = $props();
</script>

<TextInput {...props} />
