<script lang="ts">
  import type { Snippet } from 'svelte';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '#lib/components/admin/DataTable.svelte';
  import ListCard from '#lib/components/admin/ui/ListCard.svelte';
  import BadgeMedal from '#lib/components/ui/BadgeMedal.svelte';
  import { presentationOf } from '#lib/badges/presentation.js';
  import type { BadgeKind } from '@mesaaberta/core/server/badges/admin';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data } = $props();

  const number = new Intl.NumberFormat(getLocale());
  type Row = (typeof data.badges)[number] & {
    look: NonNullable<ReturnType<typeof presentationOf>>;
  };
  // A badge with no artwork yet is not shown, as on the profile.
  const rows = $derived(
    data.badges.flatMap((badge) => {
      const look = presentationOf(badge.badgeId);
      return look ? [{ ...badge, look }] : [];
    }),
  );

  const columns: DataColumn[] = [
    { id: 'badge', header: m.admin_badges_badge() },
    { id: 'kind', header: m.admin_badges_kind(), width: 'w-56' },
    { id: 'holders', header: m.admin_badges_holders(), align: 'right', width: 'w-40' },
    { id: 'revoked', header: m.admin_badges_revoked(), align: 'right', width: 'w-32' },
  ];
  const kindLabel = (kind: BadgeKind) =>
    ({
      rule: m.admin_badges_kind_rule,
      backfill: m.admin_badges_kind_backfill,
      manual: m.admin_badges_kind_manual,
    })[kind]();
</script>

{#snippet medal(row: Row)}
  <BadgeMedal icon={row.look.icon} mark={row.look.mark} size={40} />
{/snippet}

<AdminPage title={m.admin_badges_title()} lede={m.admin_badges_lede()}>
  <DataTable
    {rows}
    {columns}
    rowId={(row: Row) => row.badgeId}
    caption={m.admin_badges_title()}
    total={rows.length}
    totalLabel={m.admin_badges_total({ count: rows.length })}
    page={1}
    pageSize={Math.max(rows.length, 1)}
    sizes={false}
    empty={m.admin_badges_empty()}
  >
    {#snippet cell(row: Row, id: string)}
      {#if id === 'badge'}
        <div class="flex items-center gap-3">
          {@render medal(row)}
          <div class="min-w-0">
            <p class="font-semibold">{row.look.name()}</p>
            <p class="text-muted">{row.badgeId}</p>
          </div>
        </div>
      {:else if id === 'kind'}
        {kindLabel(row.kind)}
      {:else if id === 'holders'}
        {number.format(row.holders)}
      {:else if id === 'revoked'}
        {number.format(row.revoked)}
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet media()}{@render medal(row)}{/snippet}
        {#snippet title()}{row.look.name()}{/snippet}
        {#snippet meta()}
          <p class="truncate">{kindLabel(row.kind)}</p>
          <p class="tabular-nums">
            {m.admin_badges_holders_phone({
              count: number.format(row.holders),
              revoked: number.format(row.revoked),
            })}
          </p>
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
</AdminPage>
