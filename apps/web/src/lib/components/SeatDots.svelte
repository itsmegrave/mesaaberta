<script lang="ts">
  // The seats of a table as in the logo: a coloured dot for each one taken, a lamp-coloured ring for
  // each one free. Decorative; the text next to it says the same in words.
  let {
    taken,
    capacity,
    size = 26,
  }: { taken: number; capacity: number; size?: 26 | 34 } = $props();

  const colours = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];
  const dot = $derived(size === 34 ? 'size-8' : 'size-6');
</script>

<span aria-hidden="true" class="inline-flex flex-wrap items-center gap-1">
  {#each { length: capacity }, i (i)}
    {#if i < taken}
      <span class="block {dot} rounded-full {colours[i % colours.length]}"></span>
    {:else}
      <span class="block {dot} rounded-full border-2 border-lamp bg-lamp-wash"></span>
    {/if}
  {/each}
</span>
