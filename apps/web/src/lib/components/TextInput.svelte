<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  let {
    class: className = 'input h-12 w-full rounded-lg border-surface-200-800 px-3',
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
