<script lang="ts">
  // A table's social post, as the second state of a Mesas row: a small icon and a word under the
  // StatusBadge, not a second badge (the design system's DataTable). Muted unless it needs action:
  // amber when it has to be checked, red when it failed.
  import Icon from '#lib/components/ui/Icon.svelte';
  import { postStatus } from '#lib/admin/post-status.js';
  import type { IconName } from '#lib/icons/names.js';

  let {
    status,
    icon,
    class: className = '',
  }: { status: string | null; icon: IconName; class?: string } = $props();

  const tone = $derived(
    status === 'failed'
      ? 'text-error-700-300'
      : status === 'uncertain'
        ? 'text-lamp'
        : 'text-muted',
  );
</script>

<span
  class="inline-flex max-w-full items-center gap-2 text-sm whitespace-nowrap {tone} {className}"
>
  <Icon name={icon} size={16} class="shrink-0" />
  {postStatus(status)}
</span>
