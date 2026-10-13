<script lang="ts">
  // A table's Instagram post, as the second state of a Mesas row: a small icon and a word under the
  // StatusBadge, not a second badge (the design system's DataTable). Muted unless it needs action:
  // amber when it has to be checked, red when it failed.
  import Icon from '$lib/components/Icon.svelte';
  import { instagramStatus } from '$lib/admin/instagram-status';

  let { status, class: className = '' }: { status: string | null; class?: string } = $props();

  const tone = $derived(
    status === 'failed'
      ? 'text-error-700-300'
      : status === 'uncertain'
        ? 'text-warning-700-300'
        : 'text-muted',
  );
</script>

<span
  class="inline-flex max-w-full items-center gap-1.5 text-sm whitespace-nowrap {tone} {className}"
>
  <Icon name="instagram" size={16} class="shrink-0" />
  {instagramStatus(status)}
</span>
