<script lang="ts">
  // The app's icons by name, drawn from one sprite (`#lib/icons/sprite.generated.svg`, made by
  // `bun run icons` from the Iconify packages listed in `#lib/icons/registry.ts`). The browser
  // downloads and caches the sprite once, so neither the page's HTML nor its scripts carry the
  // geometry of every icon on it.
  // An icon with an Overdrive sticker (`#lib/icons/comic.ts`) draws both; the stylesheet shows the
  // sticker only while Overdrive paints (overdrive.css), so there is no swap after the first paint.
  import sprite from '#lib/icons/sprite.generated.svg?url';
  import { ANIMATED_ICONS } from '#lib/icons/sprite.generated.js';
  import { COMIC_ICONS } from '#lib/icons/comic.js';
  import type { IconName } from '#lib/icons/names.js';

  let {
    name,
    size = 20,
    motion = true,
    class: className = '',
  }: { name: IconName; size?: number; motion?: boolean; class?: string } = $props();

  // Symbol ids replace the collection's colon; an animated icon has a `--still` twin for reduced motion.
  const href = $derived(
    `${sprite}#${name.replaceAll(':', '--')}${!motion && ANIMATED_ICONS.includes(name) ? '--still' : ''}`,
  );
  const comic = $derived(COMIC_ICONS[name]);
</script>

<!-- Decorative: the text next to an icon says what it means. One <svg> either way; an icon with a
     sticker holds both drawings as groups on a 24-unit grid. -->
{#if comic}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    data-icon={name}
    aria-hidden="true"
    class="shrink-0 overflow-visible {className}"
  >
    <g data-look="plain"><use {href} width="24" height="24" /></g>
    <g data-look="comic" transform="rotate({comic.tilt} 12 12)" stroke-linejoin="round">
      <path d={comic.shape} transform="translate(1.4 1.4)" data-ink-shadow />
      <path d={comic.shape} data-ink class={comic.fill} stroke-width="1.8" />
      {#if comic.detail}
        <path d={comic.detail} data-ink fill="none" stroke-width="1.8" stroke-linecap="round" />
      {/if}
    </g>
  </svg>
{:else}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    data-icon={name}
    aria-hidden="true"
    class="shrink-0 {className}"><use {href} /></svg
  >
{/if}
