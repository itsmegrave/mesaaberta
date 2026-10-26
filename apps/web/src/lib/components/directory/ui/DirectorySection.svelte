<script lang="ts">
  import type { Snippet } from 'svelte';

  /** A section of a directory item's page: an h2 with an optional "Ver todas…" link beside it. */
  let {
    title,
    moreHref,
    moreLabel,
    lede,
    children,
  }: {
    title: string;
    moreHref?: string;
    moreLabel?: string;
    lede?: string;
    children: Snippet;
  } = $props();
</script>

<section class="mt-12 flex flex-col gap-6 md:mt-16">
  <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
    <h2 class="text-2xl leading-tight font-semibold tracking-tight md:text-3xl">{title}</h2>
    {#if moreHref && moreLabel}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
      <a href={moreHref} class="font-semibold text-link underline underline-offset-4">{moreLabel}</a
      >
    {/if}
  </div>
  {#if lede}<p class="-mt-3 text-muted">{lede}</p>{/if}
  {@render children()}
</section>
