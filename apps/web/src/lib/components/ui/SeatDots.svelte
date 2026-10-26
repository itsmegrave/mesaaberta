<script lang="ts">
  // The seats of a table as the hero draws them: a chair in a seat colour for each one taken, a
  // primary chair with an unfilled meeple for each one an invite holds, then a lamp-coloured one with
  // an unfilled meeple for each one free. Decorative; the text next to it says the same in words.
  import Chair, { SEAT_COLOURS } from './Chair.svelte';

  let {
    taken,
    capacity,
    reserved = 0,
    size = 26,
  }: { taken: number; capacity: number; reserved?: number; size?: 26 | 34 } = $props();

  const seat = $derived(size === 34 ? 'size-8' : 'size-6');
  const gap = $derived(size === 34 ? 'gap-2' : 'gap-1');
</script>

<span aria-hidden="true" class="inline-flex flex-wrap items-center {gap}">
  {#each { length: capacity }, i (i)}
    <svg viewBox="-30 -36 60 60" class="block {seat}">
      <Chair
        colour={i < taken
          ? SEAT_COLOURS[i % SEAT_COLOURS.length]
          : i < taken + reserved
            ? 'stroke-primary-500'
            : 'stroke-lamp'}
        free={i >= taken}
        data-seat={i < taken ? 'taken' : i < taken + reserved ? 'reserved' : 'free'}
      />
    </svg>
  {/each}
</span>
