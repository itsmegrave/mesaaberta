<script lang="ts">
  // A public score in one short line: "★ 4,6 como participante (8)", or the debut words with a
  // sprout while there are fewer ratings than the minimum. Used for the score "como participante"
  // (join requests, profile) and the GM's score inside the profile's stat tile.
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  type Rating = { score: number | null; count: number; isNew: boolean };

  let {
    rating,
    label,
    debut,
    suffix = '',
    class: className = '',
  }: {
    rating: Rating;
    /** What the score is, for screen readers ("Nota como participante"). */
    label: string;
    /** Shown instead of a number below the minimum ("Estreia como participante"). */
    debut: string;
    /** Words between the number and the count ("como participante"). */
    suffix?: string;
    class?: string;
  } = $props();

  const number = new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const scored = $derived(!rating.isNew && rating.score !== null);
</script>

<span
  class="inline-flex flex-wrap items-center gap-1.5 text-sm font-semibold text-muted {className}"
>
  {#if scored}
    <span class="sr-only">{label}:</span>
    <Icon name="star" size={16} class="text-lamp" />
    <span class="text-base font-bold text-surface-950-50 tabular-nums"
      >{number.format(rating.score!)}</span
    >
    {#if suffix}<span>{suffix}</span>{/if}
    <span
      ><span aria-hidden="true">({rating.count})</span><span class="sr-only"
        >, {m.rating_count({ count: rating.count })}</span
      ></span
    >
  {:else}
    <span class="sr-only">{label}:</span>
    <Icon name="game-icons:sprout" size={14} class="text-success-500" />
    <span>{debut}</span>
  {/if}
</span>
