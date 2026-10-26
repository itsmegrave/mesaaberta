<script lang="ts">
  import type { Snippet } from 'svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';

  /**
   * A section of a directory item's page: an h2 with an optional "Ver todas…" link beside it. With a
   * `summary` it folds on a phone (design system: Accordion), the summary saying what it holds, and
   * stays an open section on wider screens.
   */
  let {
    title,
    moreHref,
    moreLabel,
    lede,
    summary,
    children,
  }: {
    title: string;
    moreHref?: string;
    moreLabel?: string;
    lede?: string;
    /** What the folded section holds ("5 comodidades · Acessível, Empresta jogos e mais 3"). */
    summary?: string;
    children: Snippet;
  } = $props();
</script>

{#snippet more()}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
  <a href={moreHref} class="font-semibold text-link underline underline-offset-4">{moreLabel}</a>
{/snippet}

{#if summary}
  <MAAccordion collapse="phone" class="mt-8 border-y border-surface-200-800 md:mt-16 md:border-0">
    <MAAccordionItem
      value="section"
      {title}
      {summary}
      titleClass="text-xl leading-tight font-semibold tracking-tight md:text-2xl"
      class="flex flex-col gap-6"
      aside={moreHref && moreLabel ? more : undefined}
    >
      {#if lede}<p class="text-muted">{lede}</p>{/if}
      {@render children()}
    </MAAccordionItem>
  </MAAccordion>
{:else}
  <section class="mt-12 flex flex-col gap-6 md:mt-16">
    <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h2 class="text-xl leading-tight font-semibold tracking-tight md:text-2xl">{title}</h2>
      {#if moreHref && moreLabel}{@render more()}{/if}
    </div>
    {#if lede}<p class="-mt-3 text-muted">{lede}</p>{/if}
    {@render children()}
  </section>
{/if}
