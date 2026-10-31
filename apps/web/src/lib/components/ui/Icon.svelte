<script lang="ts">
  // The app's icons by name. The geometry comes from `#lib/icons/drawings.generated.js` (expanded from
  // the Iconify packages listed in `#lib/icons/registry.ts` by `bun run icons`), drawn here as a plain
  // inline SVG. The per-icon Iconify components are not imported at runtime: each pulls in a CSS file
  // with its geometry, and together they made one 40 KB render-blocking stylesheet nothing used.
  import { DRAWINGS } from '#lib/icons/drawings.generated.js';
  import type { IconName } from '#lib/icons/names.js';

  let {
    name,
    size = 20,
    motion = true,
    class: className = '',
  }: { name: IconName; size?: number; motion?: boolean; class?: string } = $props();

  // An icon with its own ids (a clip path) gets them suffixed, so two copies on a page don't clash.
  const uid = $props.id();
  const drawing = $derived(DRAWINGS[name]);
  const body = $derived.by(() => {
    let svg = motion ? drawing.body : drawing.body.replace(/<animateTransform[^>]*\/>/g, '');
    for (const [, id] of svg.matchAll(/\sid="([^"]+)"/g)) {
      svg = svg
        .replaceAll(`id="${id}"`, `id="${id}-${uid}"`)
        .replaceAll(`#${id})`, `#${id}-${uid})`);
    }
    return svg;
  });
</script>

<!-- Decorative: the text next to an icon says what it means. -->
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 {drawing.width} {drawing.height}"
  width={size}
  height={size}
  data-icon={name}
  aria-hidden="true"
  class="shrink-0 {className}"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- the generated icon geometry, never user input -->
  {@html body}
</svg>
