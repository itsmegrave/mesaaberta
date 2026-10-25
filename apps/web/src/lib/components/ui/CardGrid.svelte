<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * The grid of cards on the lists: one column on a phone, two from `md`, three from `lg`. A list
   * by default (`<li>` children); `as="div"` for stand-ins such as the skeleton. `class` adds the
   * spacing around it.
   */
  let {
    as = 'ul',
    class: className = '',
    children,
  }: { as?: 'ul' | 'div'; class?: string; children: Snippet } = $props();
</script>

<svelte:element
  this={as}
  class="{className} grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3"
>
  {@render children()}
</svelte:element>
