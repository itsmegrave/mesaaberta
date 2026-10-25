<script lang="ts">
  // Temporary while the reorganization lands: every SubmitButton becomes `<Button type="submit">`.
  import Button from './Button.svelte';
  import type { ComponentProps } from 'svelte';

  let {
    size = 'custom',
    class: className = '',
    ...props
  }: ComponentProps<typeof Button> = $props();
</script>

<Button type="submit" {size} class="gap-2 {className}" {...props} />
