<script lang="ts">
  // A GM's score as it is shown everywhere (table card, table page, /manage, profile): the
  // weighted score and how many ratings stand behind it, or "Estreia na mestragem" while there are
  // too few. Nobody sees the plain average, the GM included.
  //   full:  "★ 4,8 (12 avaliações)" or the sprout and "Estreia na mestragem (2 avaliações)".
  //   pill:  the same in a bordered pill, a group whose label carries the whole reading (table page).
  //   short: "★ 4,8" or the sprout and "Estreia", in muted 600 text (cards and lists).
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  type Rating = { score: number | null; count: number; isNew: boolean };

  let {
    rating,
    variant = 'full',
    class: className = '',
  }: { rating: Rating; variant?: 'full' | 'pill' | 'short'; class?: string } = $props();

  const number = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const votes = $derived(m.rating_count({ count: rating.count }));
  const scored = $derived(!rating.isNew && rating.score !== null);
  const score = $derived(scored ? number.format(rating.score!) : '');
  const reading = $derived(
    scored
      ? m.gm_rating_scored_label({ score, votes })
      : rating.count > 0
        ? m.gm_rating_new_label({ votes })
        : m.gm_rating_unrated_label(),
  );
</script>

{#snippet mark()}
  {#if scored}
    <Icon name="star" size={variant === 'pill' ? 20 : 16} class="shrink-0 text-lamp" />
  {:else}
    <Icon
      name="game-icons:sprout"
      size={variant === 'pill' ? 18 : 16}
      class="shrink-0 text-success-500"
    />
  {/if}
{/snippet}

{#if variant === 'short'}
  <span
    class="inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap text-muted {className}"
  >
    <span class="sr-only">{reading}</span>
    <span aria-hidden="true" class="inline-flex items-center gap-1">
      {@render mark()}
      {#if scored}<span class="tabular-nums">{score}</span>{:else}{m.gm_rating_new_short()}{/if}
    </span>
  </span>
{:else}
  <span
    role={variant === 'pill' ? 'group' : undefined}
    aria-label={variant === 'pill' ? reading : undefined}
    class="inline-flex items-center gap-2 whitespace-nowrap {variant === 'pill'
      ? 'rounded-lg border border-surface-200-800 bg-panel px-3 py-2'
      : ''} {className}"
  >
    {#if variant !== 'pill'}<span class="sr-only">{m.rating_gm_average()}:</span>{/if}
    {@render mark()}
    {#if scored}
      <span class="font-bold tabular-nums {variant === 'pill' ? 'text-xl leading-none' : ''}"
        >{score}</span
      >
    {:else}
      <span class="font-semibold {variant === 'pill' ? 'leading-none' : ''}"
        >{m.gm_rating_new()}</span
      >
    {/if}
    {#if scored || rating.count > 0}
      <span class="text-sm font-medium text-muted">({votes})</span>
    {/if}
  </span>
{/if}
