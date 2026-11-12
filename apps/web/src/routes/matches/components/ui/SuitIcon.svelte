<script lang="ts">
  import type { MatchPole } from '@mesaaberta/core/matches/schema';
  import { SUIT_PATHS } from '../suits';

  let {
    pole,
    size = 24,
    class: className = '',
  }: { pole: MatchPole; size?: number; class?: string } = $props();
</script>

<!-- A naipe: bold strokes with square ends, like a sticker drawn in marker. -->
<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2.6"
  stroke-linecap="square"
  stroke-linejoin="miter"
  aria-hidden="true"
  class="shrink-0 {className}"
>
  {#each SUIT_PATHS[pole] as d (d)}
    <path {d} />
  {/each}
</svg>
