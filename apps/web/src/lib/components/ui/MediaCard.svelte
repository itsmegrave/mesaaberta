<script module lang="ts">
  /**
   * The shell of a card that is one link (TableCard, CrowdfundingCard): its title's link stretches
   * over the card with `after:absolute`, so the card lifts on hover and rings while the link has
   * focus. Anything else clickable inside sits above that link with `relative z-10`.
   */
  export const linkedCardClass =
    'group relative flex h-full flex-col overflow-hidden rounded-lg border border-surface-200-800 bg-panel transition-shadow focus-within:ring-2 focus-within:ring-warning-500 hover:shadow-md';

  /** The quiet square icon button of a card (copy the coupon, report). */
  export const cardIconButtonClass =
    'btn size-11 shrink-0 rounded-lg p-0 text-muted hover:preset-tonal';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A card of the partner and crowdfunding lists: a 5:2 media tile with an optional pill in its
   * corner, then the body and a footer row pushed to the bottom.
   */
  let {
    linked = false,
    mediaClass = '',
    media,
    pill,
    pillTone = 'primary',
    children,
    footer,
  }: {
    /** The card is one stretched link (see `linkedCardClass`). */
    linked?: boolean;
    /** How the tile lays out its media. */
    mediaClass?: string;
    media: Snippet;
    /** The corner pill's text; none draws no pill. */
    pill?: string;
    /** `plain` is the quiet pill on the panel colour (a place's kind). */
    pillTone?: 'primary' | 'warning' | 'plain';
    children: Snippet;
    footer: Snippet;
  } = $props();

  const tones = {
    primary: 'preset-filled-primary-500',
    warning: 'preset-filled-warning-500',
    plain: 'border border-surface-200-800 bg-panel',
  };
</script>

<article
  class={linked
    ? linkedCardClass
    : 'flex h-full flex-col overflow-hidden rounded-lg border border-surface-200-800 bg-panel'}
>
  <div class="relative aspect-5/2 shrink-0 bg-surface-wash {mediaClass}">
    {@render media()}
    {#if pill}
      <span
        class="absolute top-3 left-3 chip h-6 {tones[
          pillTone
        ]} px-3 text-xs font-semibold shadow-sm">{pill}</span
      >
    {/if}
  </div>

  <div class="flex flex-1 flex-col gap-2 p-4">
    {@render children()}
    <div class="mt-auto flex items-center justify-between gap-3 pt-2">
      {@render footer()}
    </div>
  </div>
</article>
