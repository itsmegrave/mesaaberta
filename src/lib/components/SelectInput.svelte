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

<!-- A real border, not only Skeleton's inset ring: iPhones draw their own select and ignore the ring,
     which left the field without an edge. The ring is turned off so the edge is not drawn twice. -->
<select
  bind:this={element}
  bind:value
  {onchange}
  {...attributes}
  class="border border-surface-300-700 ring-0 focus:border-primary-500 {className}"
>
  {@render children()}
</select>
