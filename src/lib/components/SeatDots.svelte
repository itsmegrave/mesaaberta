<script lang="ts">
  // The seats of a table as dots: coloured for the ones taken, dashed for the free ones. Decorative;
  // the text next to it says the same in words.
  let {
    taken,
    capacity,
    size = 26,
  }: { taken: number; capacity: number; size?: 26 | 34 } = $props();

  const colours = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];
  const dot = $derived(size === 34 ? 'size-8' : 'size-6');
  const inner = $derived(size === 34 ? 'size-3' : 'size-2');
</script>

<span aria-hidden="true" class="inline-flex flex-wrap items-center gap-1">
  {#each { length: capacity }, i (i)}
    {#if i < taken}
      <span
        class="flex {dot} items-center justify-center rounded-full {colours[i % colours.length]}"
        ><span class="{inner} rounded-full bg-surface-950/30"></span></span
      >
    {:else}
      <span class="block {dot} rounded-full border-2 border-dashed border-lamp bg-lamp-wash"></span>
    {/if}
  {/each}
</span>
