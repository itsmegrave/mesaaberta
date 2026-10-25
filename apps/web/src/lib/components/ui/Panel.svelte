<script lang="ts">
  import type { Snippet } from 'svelte';

  // A bordered panel on the page's surface, with an optional heading that names it. Pages set the
  // padding through `class`.
  let {
    title,
    level = 2,
    as = 'section',
    class: className = 'p-5',
    titleClass = 'text-lg font-semibold',
    actions,
    children,
  }: {
    title?: string;
    level?: 2 | 3;
    as?: 'section' | 'aside' | 'div';
    class?: string;
    titleClass?: string;
    /** Beside the heading: a link or a menu. */
    actions?: Snippet;
    children: Snippet;
  } = $props();

  const headingId = $props.id();
  const heading = $derived(`h${level}`);
</script>

<svelte:element
  this={as}
  aria-labelledby={title ? headingId : undefined}
  class="rounded-lg border border-surface-200-800 bg-panel {className}"
>
  {#if title}
    <div class="flex items-center justify-between gap-3">
      <svelte:element this={heading} id={headingId} class={titleClass}>{title}</svelte:element>
      {@render actions?.()}
    </div>
  {/if}
  {@render children()}
</svelte:element>
