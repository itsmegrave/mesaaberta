<script lang="ts">
  // The head every admin page opens with: the "Admin" eyebrow, the section's name, one line saying
  // what it is for and, on the right, the page's own actions.
  import type { Snippet } from 'svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    title,
    lede,
    children,
  }: {
    title: string;
    lede?: string;
    /** The page actions (Atualizar, Nova tag…), on the right. */
    children?: Snippet;
  } = $props();
</script>

<header class="flex flex-wrap items-end justify-between gap-4">
  <div class="min-w-0">
    <p class="text-sm font-semibold tracking-wide text-muted uppercase">{m.nav_admin()}</p>
    <h1 class="mt-1 text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl">
      {title}
    </h1>
    {#if lede}<p class="mt-2 max-w-2xl text-surface-700-300">{lede}</p>{/if}
  </div>
  {#if children}<div class="flex flex-wrap items-center gap-2">{@render children()}</div>{/if}
</header>
