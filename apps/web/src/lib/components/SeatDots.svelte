<script lang="ts">
  // The seats of a table as the hero draws them: a chair in a seat colour for each one taken, a
  // lamp-coloured chair with a dashed head for each one free. Decorative; the text next to it says
  // the same in words.
  import Chair from './Chair.svelte';

  let {
    taken,
    capacity,
    size = 26,
  }: { taken: number; capacity: number; size?: 26 | 34 } = $props();

  const colours = [
    'fill-success-500 stroke-success-500',
    'fill-tertiary-400 stroke-tertiary-400',
    'fill-secondary-300 stroke-secondary-300',
  ];
  const seat = $derived(size === 34 ? 'size-8' : 'size-6');
  const gap = $derived(size === 34 ? 'gap-2' : 'gap-1');
</script>

<span aria-hidden="true" class="inline-flex flex-wrap items-center {gap}">
  {#each { length: capacity }, i (i)}
    <svg viewBox="-30 -36 60 60" class="block {seat}">
      <Chair
        colour={i < taken ? colours[i % colours.length] : 'fill-lamp-wash stroke-lamp'}
        person={i >= taken ? 'dashed' : 'solid'}
      />
    </svg>
  {/each}
</span>
