<script lang="ts" generics="T">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import MAButton from './MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';

  /**
   * A sideways row of table cards on Início ("Novas mesas", "Mesas abertas"): the cards, then a
   * "Veja mais" tile the size of a card that links to the full list. The row runs into the page
   * gutter so the next card peeks in; the page column already clips sideways overflow, so the row
   * needs no width of its own. On a wide screen two buttons move it a page at a time; on a phone it
   * is swiped. It never moves by itself. Every card fills its slot: the same width (`itemClass`) and,
   * since the row stretches its items, the height of the tallest card.
   */
  let {
    id,
    title,
    lede,
    items,
    key,
    card,
    itemClass,
    moreHref,
    moreCaption,
    action,
  }: {
    /** The heading's id; the section and the list are labelled by it. */
    id: string;
    title: string;
    lede?: string;
    items: T[];
    key: (item: T) => string;
    card: Snippet<[T]>;
    /** The width of each card (and of the "Veja mais" tile), as classes. */
    itemClass: string;
    /** The "Veja mais" tile; without it the row is the whole list. */
    moreHref?: string;
    moreCaption?: string;
    /** A link beside the title ("Editar sistemas"). */
    action?: Snippet;
  } = $props();

  let track = $state<HTMLUListElement>();
  let atStart = $state(true);
  let atEnd = $state(false);
  let overflows = $state(false);

  function measure() {
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    overflows = scrollWidth > clientWidth + 1;
    atStart = scrollLeft <= 1;
    atEnd = scrollLeft + clientWidth >= scrollWidth - 1;
  }

  $effect(() => {
    if (!track) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  });

  function page(direction: 1 | -1) {
    if (!track) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollBy({
      left: direction * track.clientWidth * 0.9,
      behavior: still ? 'auto' : 'smooth',
    });
  }
</script>

<section aria-labelledby={id} class="flex flex-col gap-4 md:gap-6">
  <div class="flex items-end justify-between gap-4">
    <div class="flex flex-col gap-2">
      <h2 {id} class="text-xl leading-tight font-semibold tracking-tight text-balance md:text-2xl">
        {title}
      </h2>
      {#if lede}<p class="text-muted">{lede}</p>{/if}
    </div>
    {#if action}<div class="ml-auto shrink-0">{@render action()}</div>{/if}
    {#if overflows}
      <div class="hidden shrink-0 gap-2 md:flex">
        <MAButton
          size="custom"
          variant="secondary"
          class="flex size-11 items-center justify-center rounded-full"
          aria-label={m.home_carousel_previous()}
          aria-controls="{id}-track"
          aria-disabled={atStart || undefined}
          onclick={() => !atStart && page(-1)}
        >
          <Icon name="arrow-left" size={18} />
        </MAButton>
        <MAButton
          size="custom"
          variant="secondary"
          class="flex size-11 items-center justify-center rounded-full"
          aria-label={m.home_carousel_next()}
          aria-controls="{id}-track"
          aria-disabled={atEnd || undefined}
          onclick={() => !atEnd && page(1)}
        >
          <Icon name="arrow-right" size={18} />
        </MAButton>
      </div>
    {/if}
  </div>

  <!-- The negative margins match main's padding, so the row reaches the edge and snaps on the gutter. -->
  <ul
    bind:this={track}
    id="{id}-track"
    aria-labelledby={id}
    onscroll={measure}
    class="-mx-5 flex snap-x snap-mandatory scroll-px-5 scrollbar-none gap-3 overflow-x-auto overscroll-x-contain px-5 pt-1 pb-2 md:-mx-8 md:scroll-px-8 md:gap-6 md:px-8 [&::-webkit-scrollbar]:hidden"
  >
    {#each items as item (key(item))}
      <!-- *:w-full: a card sizes to its content in a flex row, so a short title would draw a narrow card. -->
      <li class="flex shrink-0 snap-start *:w-full {itemClass}">{@render card(item)}</li>
    {/each}
    {#if moreHref}
      <li class="flex shrink-0 snap-start {itemClass}">
        <a
          href={moreHref}
          class="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-surface-200-800 bg-surface-wash p-6 text-center no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          <span
            aria-hidden="true"
            class="flex size-14 items-center justify-center rounded-full preset-filled-primary-500"
          >
            <Icon name="arrow-right" size={20} />
          </span>
          <span class="text-2xl leading-tight font-semibold tracking-tight"
            >{m.home_carousel_more()}</span
          >
          <span class="text-sm font-semibold text-muted">{moreCaption}</span>
        </a>
      </li>
    {/if}
  </ul>
</section>
