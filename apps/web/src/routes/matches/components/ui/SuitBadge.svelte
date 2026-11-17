<script lang="ts">
  import type { MatchPole } from '@mesaaberta/core/matches/schema';
  import { poleName } from '../suits';
  import SuitIcon from './SuitIcon.svelte';

  let {
    pole,
    percent,
    size = 48,
    corner = 'none',
  }: {
    pole: MatchPole;
    /** How far the person leans to this pole, 50 to 100. */
    percent: number;
    size?: 40 | 48 | 56 | 64;
    /** Where it sits on a card: the top ones tilt out, the bottom ones stand upside down too. */
    corner?: 'none' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  } = $props();

  // Classes only (the CSP refuses inline styles): one per size and per corner.
  const SIZE = { 40: 'size-10', 48: 'size-12', 56: 'size-14', 64: 'size-16' } as const;
  const TURN = {
    none: '',
    'top-left': '-rotate-8',
    'top-right': 'rotate-8',
    'bottom-left': 'rotate-188',
    'bottom-right': 'rotate-172',
  } as const;

  // Ten segments around the badge; as many lit as tenths of the lean. Precise illustration
  // geometry: arcs of 26° with 10° gaps, starting at the top.
  const SEGMENTS = 10;
  const stroke = $derived(Math.max(4, Math.floor(size / 11)));
  const radius = $derived(size / 2 - 3 - stroke / 2 - 1);
  const lit = $derived(Math.round(percent / 10));
  const arc = (i: number) => {
    const c = size / 2;
    const at = (deg: number) => [
      c + radius * Math.sin((deg * Math.PI) / 180),
      c - radius * Math.cos((deg * Math.PI) / 180),
    ];
    const [x1, y1] = at(i * 36 + 5);
    const [x2, y2] = at(i * 36 + 31);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const label = $derived(`${poleName(pole)}: ${percent}%`);
</script>

<span
  role="img"
  aria-label={label}
  title={label}
  class="relative inline-flex shrink-0 items-center justify-center rounded-full border-3 border-punk-ink bg-punk-paper text-punk-ink shadow-[3px_3px_0_var(--color-punk-ink)] {SIZE[
    size
  ]} {TURN[corner]}"
>
  <svg
    width={size}
    height={size}
    viewBox="0 0 {size} {size}"
    fill="none"
    stroke-width={stroke}
    aria-hidden="true"
    class="absolute -top-0.75 -left-0.75"
  >
    {#each { length: SEGMENTS } as _, i (i)}
      <path d={arc(i)} class={i < lit ? 'stroke-punk-pink' : 'stroke-punk-ink/15'} />
    {/each}
  </svg>
  <SuitIcon {pole} size={Math.round(size * 0.44)} class="relative" />
</span>
