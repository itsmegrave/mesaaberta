<svelte:options namespace="svg" />

<script lang="ts">
  import type { SVGAttributes } from 'svelte/elements';

  // One seat as the hero draws it, in the seat's own frame where +y points at the table: the
  // backrest is a half-circle arc on the far side, the person a head in front of it. The caller
  // places it inside an <svg> (SeatDots, SeatRing, TableIllustration).
  // head: `solid` a taken seat, `dashed` a free one, `ring` the hero's empty chair.
  let {
    colour,
    head = 'solid',
    ...rest
  }: {
    /** Fill and stroke classes, e.g. `fill-success-500 stroke-success-500`. */
    colour: string;
    head?: 'solid' | 'dashed' | 'ring';
  } & SVGAttributes<SVGGElement> = $props();

  const backrest = 'M-26.1 -7A27 27 0 0 1 26.1 -7';
</script>

<g {...rest} class={colour} data-chair={head === 'solid' ? 'taken' : 'free'}>
  <path d={backrest} class="fill-none" stroke-width="5" stroke-linecap="round" />
  {#if head === 'dashed'}
    <circle r="15" cy="2" stroke-width="4" stroke-dasharray="6 5.8" />
  {:else if head === 'ring'}
    <circle r="15" cy="2" stroke-width="4" data-empty-seat />
  {:else}
    <circle r="15" cy="2" />
  {/if}
</g>
