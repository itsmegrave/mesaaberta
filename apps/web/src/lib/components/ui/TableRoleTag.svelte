<script lang="ts">
  // What the person does at the table, as a small chip: "Mestra" and "Mestra e joga" on the lamp
  // wash (they are in Quem mestra), "Joga" on the quiet wash. Nothing for no answer.
  import type { TableRole } from '@mesaaberta/core/profile/schema';
  import { m } from '#lib/paraglide/messages.js';

  let { tableRole, class: className = '' }: { tableRole: TableRole | null; class?: string } =
    $props();

  const LABELS: Record<TableRole, () => string> = {
    gm: m.profile_role_tag_gm,
    both: m.profile_role_tag_both,
    player: m.profile_role_tag_player,
  };
</script>

{#if tableRole}
  <span
    class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold {tableRole ===
    'player'
      ? 'bg-surface-wash'
      : 'bg-lamp-wash'} {className}">{LABELS[tableRole]()}</span
  >
{/if}
