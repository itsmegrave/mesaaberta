<script lang="ts">
  // A GM's score as it is shown everywhere (table card, table page, /manage, profile): the
  // weighted score and how many ratings stand behind it, or "Novo mestre" while there are too few.
  // Nobody sees the plain average, the GM included.
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  type Rating = { score: number | null; count: number; isNew: boolean };

  let { rating, class: className = '' }: { rating: Rating; class?: string } = $props();

  const number = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const votes = $derived(m.rating_count({ count: rating.count }));
  const scored = $derived(!rating.isNew && rating.score !== null);
  const text = $derived(
    scored
      ? `${number.format(rating.score!)} · ${votes}`
      : rating.count > 0
        ? `${m.gm_rating_new()} · ${votes}`
        : m.gm_rating_new(),
  );
</script>

<span class="inline-flex items-center gap-1.5 whitespace-nowrap {className}">
  <span class="sr-only">{m.rating_gm_average()}:</span>
  {#if scored}<Icon name="star" size={16} class="shrink-0 text-lamp" />{/if}
  <span class={scored ? 'font-semibold tabular-nums' : ''}>{text}</span>
</span>
