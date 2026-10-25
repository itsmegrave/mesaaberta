<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  let {
    class: className = 'input h-13 w-full rounded-lg border-control border-ink-muted px-3',
    value = $bindable(''),
    element = $bindable(),
    ...attributes
  }: Omit<HTMLInputAttributes, 'value'> & {
    /** A number for `type="number"`, which the browser hands back as a number (null when empty). */
    value?: string | number | null;
    element?: HTMLInputElement;
  } = $props();
</script>

<input bind:this={element} {...attributes} bind:value class={className} />
