<script lang="ts">
  import { m } from '#lib/paraglide/messages.js';
  import { isContentRating } from '@mesaaberta/core/tables/safety';
  import { contentRatingLongLabel } from '#lib/tables/safety-labels.js';
  import {
    CONTENT_RATING_FILL,
    CONTENT_RATING_SYMBOLS,
  } from '#lib/tables/content-rating-symbol.js';

  /**
   * A table's age rating as the ClassInd self-classification symbol (DS ContentRating): the
   * official colour square with its mandatory white border and "A14" in white. Nothing for no
   * rating, or one it does not know. `size` in px: 70 on the table page, 32 on a card, 24 in a row.
   */
  let {
    rating,
    size = 32,
    class: className = '',
  }: { rating: string | null | undefined; size?: number; class?: string } = $props();

  const known = $derived(rating && isContentRating(rating) ? rating : null);
</script>

{#if known}
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    role="img"
    aria-label={m.content_rating_symbol({ rating: contentRatingLongLabel(known) })}
    class="block shrink-0 {className}"
  >
    <rect width="48" height="48" rx="8" class="fill-white" />
    <rect x="2" y="2" width="44" height="44" rx="6" class={CONTENT_RATING_FILL[known]} />
    <path d={CONTENT_RATING_SYMBOLS[known].path} class="fill-white" />
  </svg>
{/if}
