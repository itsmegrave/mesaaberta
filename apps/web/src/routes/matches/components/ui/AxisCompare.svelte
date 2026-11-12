<script lang="ts">
  import { MATCH_AXES, leaning, type MatchAxis } from '@mesaaberta/core/matches/schema';
  import { m } from '#lib/paraglide/messages.js';
  import { poleName } from '../suits';
  import SuitIcon from './SuitIcon.svelte';

  // One axis read-only, as "Ver mais" shows it: the person's mark and, hollow, the viewer's. Drawn
  // in SVG so the marks sit by attribute (the CSP refuses inline styles).
  let {
    axis,
    value,
    mine = null,
  }: { axis: MatchAxis; value: number; mine?: number | null } = $props();

  const [first, second] = $derived(MATCH_AXES.find((a) => a.key === axis)!.poles);
  const lean = $derived(leaning(axis, value));
  // 0 is all the way to the first pole, on the left. Track from 8 to 192 in a 200-wide box.
  const at = (v: number) => 8 + ((100 - v) / 100) * 184;
</script>

<div class="flex items-center gap-2 text-punk-ink">
  {@render end(first)}
  <svg
    viewBox="0 0 200 24"
    class="h-7 min-w-0 flex-1"
    role="img"
    aria-label={m.match_axis_value({ pole: poleName(lean.pole), percent: lean.percent })}
  >
    <rect
      x="8"
      y="7"
      width="184"
      height="10"
      rx="5"
      class="fill-punk-yellow stroke-punk-ink"
      stroke-width="2"
    />
    <rect x="98.5" y="4" width="3" height="16" class="fill-punk-ink" />
    {#if mine !== null}
      <circle
        cx={at(mine)}
        cy="12"
        r="6"
        class="fill-punk-paper stroke-punk-ink"
        stroke-width="3"
        stroke-dasharray="3 2"
      />
    {/if}
    <circle cx={at(value)} cy="12" r="8" class="fill-punk-pink stroke-punk-ink" stroke-width="3" />
  </svg>
  {@render end(second)}
</div>

{#snippet end(pole: (typeof MATCH_AXES)[number]['poles'][number])}
  <span
    class="flex w-16 shrink-0 flex-col items-center gap-0.5 text-xs whitespace-nowrap {lean.pole ===
    pole
      ? 'font-bold'
      : 'font-medium opacity-70'}"
  >
    <SuitIcon {pole} size={20} />{poleName(pole)}
  </span>
{/snippet}
