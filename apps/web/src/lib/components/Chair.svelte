<svelte:options namespace="svg" />

<script module lang="ts">
  import { DRAWINGS } from '#lib/icons/drawings.generated.js';

  // The person is the app's meeple (game-icons:meeple), the same icon as every person elsewhere;
  // the GM is the abbot meeple.
  const shape = (name: 'game-icons:meeple' | 'game-icons:abbot-meeple') =>
    DRAWINGS[name].body.match(/ d="([^"]+)"/)?.[1] ?? '';
  const MEEPLES = { player: shape('game-icons:meeple'), gm: shape('game-icons:abbot-meeple') };
</script>

<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  // One seat as the hero draws it, in the seat's own frame where +y points at the table: the
  // backrest is a half-circle arc on the far side, the person a meeple in front of it. The caller
  // places it inside an <svg> (SeatDots, SeatRing, TableIllustration).
  // person: `solid` a taken seat, `dashed` a free one, `ring` the hero's empty chair.
  let {
    colour,
    person = 'solid',
    gm = false,
    ...rest
  }: {
    /** Fill and stroke classes, e.g. `fill-success-500 stroke-success-500`. */
    colour: string;
    person?: 'solid' | 'dashed' | 'ring';
    /** The GM's seat: the abbot meeple. */
    gm?: boolean;
  } & SVGAttributes<SVGGElement> = $props();

  const backrest = 'M-26.1 -7A27 27 0 0 1 26.1 -7';
  const meeple = $derived(gm ? MEEPLES.gm : MEEPLES.player);
  // The meeple's 512-unit drawing, centred where the head used to sit and about 35 units wide.
  // Outline widths are in its own units: 50 ≈ 4 chair units.
  const place = 'translate(0 2) scale(0.08) translate(-256 -256)';
</script>

<g {...rest} class={colour} data-chair={person === 'solid' ? 'taken' : 'free'}>
  <path d={backrest} class="fill-none" stroke-width="5" stroke-linecap="round" />
  {#if person === 'dashed'}
    <path
      d={meeple}
      transform={place}
      stroke-width="50"
      stroke-dasharray="75 72"
      stroke-linejoin="round"
    />
  {:else if person === 'ring'}
    <path d={meeple} transform={place} stroke-width="50" stroke-linejoin="round" data-empty-seat />
  {:else}
    <path d={meeple} transform={place} class="stroke-none" />
  {/if}
</g>
