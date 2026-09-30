<script lang="ts">
  // The app's icons: Lucide and Game Icons, through Iconify's offline component. The drawings come from
  // `$lib/icons/lucide.generated` (see `$lib/icons/names`), so nothing is fetched at run time.
  import OfflineIcon from '@iconify/svelte/dist/OfflineIcon.svelte';
  import { ICONS } from '$lib/icons/lucide.generated';
  import type { IconName } from '$lib/icons/names';

  let {
    name,
    size = 20,
    class: className = '',
  }: { name: IconName; size?: number; class?: string } = $props();
</script>

<!-- Decorative: the text next to an icon says what it means. -->
<OfflineIcon
  icon={ICONS[name]}
  width={size}
  height={size}
  aria-hidden="true"
  class="shrink-0 {className}"
/>
