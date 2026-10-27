<script lang="ts">
  // What the person does at the table, as a small chip: "Mestra" and "Mestra e joga" on the lamp
  // wash (they are in Quem mestra), "Joga" on the quiet wash. Nothing for no answer. With `href`
  // the chip is a link (the profile's to Quem mestra).
  import type { TableRole } from '@mesaaberta/core/profile/schema';
  import { m } from '#lib/paraglide/messages.js';

  let {
    tableRole,
    href,
    class: className = '',
  }: { tableRole: TableRole | null; href?: string; class?: string } = $props();

  const LABELS: Record<TableRole, () => string> = {
    gm: m.profile_role_tag_gm,
    both: m.profile_role_tag_both,
    player: m.profile_role_tag_player,
  };
</script>

{#if tableRole}
  {@const chip = `inline-flex h-6 items-center rounded-full px-2 text-xs font-semibold ${
    tableRole === 'player' ? 'bg-surface-wash' : 'bg-lamp-wash'
  } ${className}`}
  {#if href}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
    <a {href} class="{chip} no-underline hover:underline">{LABELS[tableRole]()}</a>
  {:else}
    <span class={chip}>{LABELS[tableRole]()}</span>
  {/if}
{/if}
