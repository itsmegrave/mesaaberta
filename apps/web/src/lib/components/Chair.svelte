<svelte:options namespace="svg" />

<script module lang="ts">
  import { DRAWINGS } from '#lib/icons/drawings.generated.js';

  // The person is the app's meeple (game-icons:meeple), the same icon as every person elsewhere.
  const meeple = DRAWINGS['game-icons:meeple'].body.match(/ d="([^"]+)"/)?.[1] ?? '';
</script>

<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  // One seat as the hero draws it, in the seat's own frame where +y points at the table: the
  // backrest is a half-circle arc on the far side, the person a meeple in front of it. The caller
  // places it inside an <svg> (SeatDots, SeatRing, TableIllustration).
  let {
    colour,
    free = false,
    gm = false,
    ...rest
  }: {
    /** Fill and stroke classes, e.g. `fill-success-500 stroke-success-500`. */
    colour: string;
    /** An open seat: the meeple is an outline, unfilled. */
    free?: boolean;
    /** The GM's seat: the same meeple with a thin outline around it. */
    gm?: boolean;
  } & SVGAttributes<SVGGElement> = $props();

  const backrest = 'M-26.1 -7A27 27 0 0 1 26.1 -7';
  // The meeple's 512-unit drawing, centred in front of the backrest and about 35 units wide. Stroke
  // widths are in its own units: 12.5 ≈ 1 chair unit.
  const place = 'translate(0 2) scale(0.08) translate(-256 -256)';
  // The GM's outline: the meeple a quarter larger, stroked 1 unit, leaving a gap around the person.
  const halo = 'translate(0 2) scale(0.1) translate(-256 -256)';
</script>

<g {...rest} class={colour} data-chair={free ? 'free' : 'taken'}>
  <path d={backrest} class="fill-none" stroke-width="5" stroke-linecap="round" />
  {#if gm}
    <path d={meeple} transform={halo} class="fill-none" stroke-width="10" data-gm-chair />
  {/if}
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
