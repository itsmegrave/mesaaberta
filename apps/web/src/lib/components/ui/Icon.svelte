<script lang="ts">
  // The app's icons by name, drawn from one sprite (`#lib/icons/sprite.generated.svg`, made by
  // `bun run icons` from the Iconify packages listed in `#lib/icons/registry.ts`). The browser
  // downloads and caches the sprite once, so neither the page's HTML nor its scripts carry the
  // geometry of every icon on it.
  import sprite from '#lib/icons/sprite.generated.svg?url';
  import { ANIMATED_ICONS } from '#lib/icons/sprite.generated.js';
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
</script>

<!-- Decorative: the text next to an icon says what it means. -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  data-icon={name}
  aria-hidden="true"
  class="shrink-0 {className}"><use {href} /></svg
>
