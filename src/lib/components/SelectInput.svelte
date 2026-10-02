<script lang="ts" generics="T extends string | number | string[]">
  import type { Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';
  let {
    value = $bindable(undefined as T | undefined),
    element = $bindable(),
    children,
    onchange,
    class: className = 'select h-12 w-full rounded-lg border-surface-200-800 px-3',
    ...attributes
  }: Omit<HTMLSelectAttributes, 'value'> & {
    value?: T;
    element?: HTMLSelectElement;
    children: Snippet;
  } = $props();
</script>

<select bind:this={element} bind:value {onchange} {...attributes} class={className}>
  {@render children()}
</select>
