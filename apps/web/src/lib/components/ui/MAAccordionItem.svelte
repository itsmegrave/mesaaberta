<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import CountBadge from './CountBadge.svelte';
  import Icon from './Icon.svelte';
  import { accordionMode } from './MAAccordion.svelte';

  // One section of an MAAccordion: a heading whose button opens the content, with a line under the
  // title that says what the closed section holds ("6 de 6 presentes", "4,8 · 12 avaliações").
  let {
    value,
    title,
    summary,
    count = 0,
    countLabel,
    level = 2,
    titleClass = 'text-lg font-semibold',
    summaryOnWide = false,
    class: className = '',
    aside,
    children,
  }: {
    value: string;
    title: string;
    summary?: string;
    /** Something that needs attention inside (pending requests): a `warning` badge beside the title. */
    count?: number;
    /** Says what `count` counts, for screen readers. */
    countLabel?: string;
    level?: 2 | 3;
    /** The title's size and weight; a page may keep its own heading size on wide screens. */
    titleClass?: string;
    /** Keep the summary beside the title when the section renders open on a wide screen ("3 de 5 vagas"). */
    summaryOnWide?: boolean;
    /** Classes for the content. */
    class?: string;
    /** A control for the whole section ("Ver todas"): beside the title when the section renders
     * open on a wide screen, at the top of the content when it can fold (a button cannot sit inside
     * the header button). */
    aside?: Snippet;
    children: Snippet;
  } = $props();

  const mode = accordionMode();
  const id = $props.id();
  const heading = $derived(`h${level}`);
</script>

{#if mode.flat}
  <section aria-labelledby={id} class="py-4 first:pt-0 last:pb-0">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <svelte:element this={heading} {id} class="flex items-center gap-2 {titleClass}">
        {title}<CountBadge {count} aria-label={countLabel} />
      </svelte:element>
      {#if summary && summaryOnWide}
        <span class="font-semibold text-muted">{summary}</span>
      {/if}
      {@render aside?.()}
    </div>
    <div class="mt-3 {className}">{@render children()}</div>
  </section>
{:else}
  <Accordion.Item {value}>
    <svelte:element this={heading}>
      <Accordion.ItemTrigger
        class="flex min-h-14 w-full cursor-pointer items-center gap-3 py-4 text-left {mode.collapse ===
        'phone'
          ? 'md:pointer-events-none'
          : ''}"
      >
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex items-center gap-2 {titleClass}"
            >{title}<CountBadge {count} aria-label={countLabel} /></span
          >
          {#if summary}
            <span class="text-sm text-muted {mode.collapse === 'phone' ? 'md:hidden' : ''}"
              >{summary}</span
            >
          {/if}
        </span>
        <Accordion.ItemIndicator
          class="flex text-muted transition-transform duration-150 data-[state=open]:rotate-180 motion-reduce:transition-none {mode.collapse ===
          'phone'
            ? 'md:hidden'
            : ''}"
        >
          <Icon name="chevron-down" />
        </Accordion.ItemIndicator>
      </Accordion.ItemTrigger>
    </svelte:element>
    <Accordion.ItemContent class="pb-4 {mode.collapse === 'phone' ? 'md:block!' : ''} {className}">
      {#if aside}<div class="mb-4">{@render aside()}</div>{/if}
      {@render children()}
    </Accordion.ItemContent>
  </Accordion.Item>
{/if}
