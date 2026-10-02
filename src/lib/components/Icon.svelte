<script lang="ts">
  // The app's icons by name, from the per-icon components in `$lib/icons/registry`.
  import { DRAWINGS } from '$lib/icons/drawings.generated';
  import { ICONS } from '$lib/icons/registry';
  import type { IconName } from '$lib/icons/names';

  let {
    name,
    size = 20,
    class: className = '',
  }: { name: IconName; size?: number; class?: string } = $props();

  const Component = $derived(ICONS[name]);
  // Embed SVG attributes for SSR and offline rendering; no CSS geometry or remote fallback.
  const drawing = $derived({ content: DRAWINGS[name], fallback: DRAWINGS[name] });
</script>

<!-- Decorative: the text next to an icon says what it means. -->
<Component
  {...drawing}
  width={String(size)}
  height={String(size)}
  data-icon={name}
  aria-hidden="true"
  class="shrink-0 {className}"
/>
