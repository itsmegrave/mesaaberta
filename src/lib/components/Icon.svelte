<script lang="ts">
  // The app's icons by name, from the per-icon components in `$lib/icons/registry`.
  import { ICONS } from '$lib/icons/registry';
  import type { IconName } from '$lib/icons/names';

  let {
    name,
    size = 20,
    class: className = '',
  }: { name: IconName; size?: number; class?: string } = $props();

  const Component = $derived(ICONS[name]);
</script>

<!-- Decorative: the text next to an icon says what it means. -->
<Component
  width={String(size)}
  height={String(size)}
  aria-hidden="true"
  class="shrink-0 {className}"
/>
