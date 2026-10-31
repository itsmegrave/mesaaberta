<svelte:options namespace="svg" />

<script module lang="ts">
  import { MEEPLE_PATH as meeple } from '#lib/icons/sprite.generated.js';

  // The person is the app's meeple (game-icons:meeple), the same icon as every person elsewhere.

  /** The taken seats' colours, in order around the table (SeatDots, SeatRing, TableIllustration). */
  export const SEAT_COLOURS = [
    'fill-success-500 stroke-success-500',
    'fill-tertiary-400 stroke-tertiary-400',
    'fill-secondary-300 stroke-secondary-300',
  ];
</script>

<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  // One seat as the hero draws it, in the seat's own frame where +y points at the table: the
  // backrest is a half-circle arc on the far side, the person a meeple in front of it. The caller
  // places it inside an <svg> (SeatDots, SeatRing, TableIllustration).
  let {
    colour = '',
    free = false,
    gm = false,
    ...rest
  }: {
    /** Fill and stroke classes, e.g. `fill-success-500 stroke-success-500`. */
    colour?: string;
    /** An open seat: the meeple is an outline, unfilled. */
    free?: boolean;
    /**
     * The GM's seat: the backrest and the meeple in the three seat colours at once (a gradient),
     * the meeple with a 1px ink border. `colour` is then ignored.
     */
    gm?: boolean;
  } & SVGAttributes<SVGGElement> = $props();

  const backrest = 'M-26.1 -7A27 27 0 0 1 26.1 -7';
  // The meeple's 512-unit drawing, centred in front of the backrest and about 35 units wide. Stroke
  // widths are in its own units: 12.5 ≈ 1 chair unit.
  const place = 'translate(0 2) scale(0.08) translate(-256 -256)';

  // A gradient's id must be unique in the document; a page shows several chairs.
  const gradient = $props.id();
</script>

{#if gm}
  <g {...rest} data-chair="taken">
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" data-stop="1" />
        <stop offset="0.5" data-stop="2" />
        <stop offset="1" data-stop="3" />
      </linearGradient>
    </defs>
    <path
      d={backrest}
      fill="none"
      stroke="url(#{gradient})"
      stroke-width="5"
      stroke-linecap="round"
    />
    <path
      d={meeple}
      transform={place}
      fill="url(#{gradient})"
      class="stroke-surface-950"
      stroke-width="1"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
      data-gm-chair
    />
  </g>
{:else}
  <g {...rest} class={colour} data-chair={free ? 'free' : 'taken'}>
    <path d={backrest} class="fill-none" stroke-width="5" stroke-linecap="round" />
    {#if free}
      <path
        d={meeple}
        transform={place}
        class="fill-none"
        stroke-width="31"
        stroke-linejoin="round"
      />
    {:else}
      <path d={meeple} transform={place} class="stroke-none" />
    {/if}
  </g>
{/if}

<style>
  /* The GM's gradient: the three seat colours, set here because the CSP blocks inline styles. */
  [data-stop='1'] {
    stop-color: var(--color-success-500);
  }
  [data-stop='2'] {
    stop-color: var(--color-tertiary-400);
  }
  [data-stop='3'] {
    stop-color: var(--color-secondary-300);
  }
</style>
