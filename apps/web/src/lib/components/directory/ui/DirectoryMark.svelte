<script lang="ts">
  import { initialsOf } from '#lib/directory/initials.js';

  /**
   * The square mark of a directory entry (a game system): its approved logo on a quiet wash, or
   * without one its initials on the primary colour. `md` is the card's 56px; `lg` the item page's,
   * 64px on a phone and 112px up. Decorative: the name is always written next to it.
   */
  let {
    name,
    src = null,
    size = 'md',
  }: { name: string; src?: string | null; size?: 'md' | 'lg' } = $props();

  const box = $derived(
    size === 'lg'
      ? 'size-16 rounded-lg text-2xl md:size-28 md:rounded-xl md:text-4xl'
      : 'size-14 rounded-lg text-xl',
  );
</script>

{#if src}
  <!-- A logo drawn for a light or a dark page reads on the wash in both themes. -->
  <span
    aria-hidden="true"
    class="flex shrink-0 items-center justify-center bg-surface-wash p-1 {box}"
    ><img {src} alt="" loading="lazy" class="max-h-full max-w-full object-contain" /></span
  >
{:else}
  <span
    aria-hidden="true"
    class="flex shrink-0 items-center justify-center preset-filled-primary-500 font-bold tracking-tight {box}"
    >{initialsOf(name)}</span
  >
{/if}
