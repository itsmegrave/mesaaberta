<script lang="ts">
  import { initialsOf } from '#lib/directory/initials.js';

  /**
   * The square mark of a directory entry with no picture (a game system): its initials on the
   * primary colour. `md` is the card's 56px; `lg` the item page's, 64px on a phone and 112px up.
   * Decorative: the name is always written next to it.
   */
  let { name, size = 'md' }: { name: string; size?: 'md' | 'lg' } = $props();
</script>

<span
  aria-hidden="true"
  class="flex shrink-0 items-center justify-center preset-filled-primary-500 font-bold tracking-tight {size ===
  'lg'
    ? 'size-16 rounded-lg text-2xl md:size-28 md:rounded-xl md:text-4xl'
    : 'size-14 rounded-lg text-xl'}">{initialsOf(name)}</span
>
