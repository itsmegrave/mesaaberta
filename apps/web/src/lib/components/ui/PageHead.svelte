<script lang="ts">
  import type { Snippet } from 'svelte';
  import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';

  /**
   * The head of a public page: the breadcrumbs, the big title and its lede, with the page's actions
   * beside them from `md` up (under them on a phone).
   */
  let {
    crumbs,
    crumbsClass = 'mb-8',
    title,
    lede,
    actions,
  }: {
    /** The breadcrumb levels after "Início"; none draws no trail. */
    crumbs?: { label: string; href?: string }[];
    crumbsClass?: string;
    title: string;
    lede?: string;
    actions?: Snippet;
  } = $props();
</script>

{#snippet heading()}
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {title}
  </h1>
  {#if lede}
    <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
      {lede}
    </p>
  {/if}
{/snippet}

{#if crumbs}
  <Breadcrumbs class={crumbsClass} items={crumbs} />
{/if}
{#if actions}
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
    <div>{@render heading()}</div>
    {@render actions()}
  </div>
{:else}
  {@render heading()}
{/if}
