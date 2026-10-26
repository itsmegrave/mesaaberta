<script lang="ts">
  // A badge beside a name on the table's roster: the small medal, its name for screen readers and
  // on hover. Draws nothing for a badge with no artwork yet, as the profile does.
  import BadgeMedal from '#lib/components/ui/BadgeMedal.svelte';
  import { presentationOf } from '#lib/badges/presentation.js';

  let { badgeId }: { badgeId: string } = $props();

  const look = $derived(presentationOf(badgeId));
</script>

{#if look}
  <span title={look.name()} class="inline-flex shrink-0 align-middle">
    <span class="sr-only">{look.name()}</span>
    <BadgeMedal icon={look.icon} mark={look.mark} size={20} />
  </span>
{/if}
