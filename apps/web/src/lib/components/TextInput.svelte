<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  let {
    class: className = 'input h-12 w-full rounded-lg border-surface-200-800 px-3',
    value = $bindable(''),
    element = $bindable(),
    ...attributes
  }: Omit<HTMLInputAttributes, 'value'> & { value?: string; element?: HTMLInputElement } = $props();
</script>

<input bind:this={element} {...attributes} bind:value class={className} />
