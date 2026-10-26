<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Target } from '#lib/target.svelte.js';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '#lib/components/admin/DataTable.svelte';
  import ListCard from '#lib/components/admin/ui/ListCard.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import SegmentedFilter from '#lib/components/admin/SegmentedFilter.svelte';
  import type { KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import StatusBadge, { type Status } from '#lib/components/ui/StatusBadge.svelte';
  import { shortDate } from '#lib/admin/format.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { RESOLUTION_NOTE_MAX } from '@mesaaberta/core/moderation/reports';
  import {
    approveClaimSchema,
    PLACE_CLAIM_STATUSES,
    rejectClaimSchema,
    type PlaceClaimRelation,
  } from '@mesaaberta/core/places/claims';
  import type { AdminClaims } from '@mesaaberta/core/server/places/claims';

  type Row = AdminClaims['rows'][number];
  let { data }: { data: { claims: AdminClaims } } = $props();
  const list = $derived(data.claims);
  const locale = getLocale();

  const columns: DataColumn[] = [
    { id: 'place', header: m.admin_claims_col_place() },
    { id: 'claimant', header: m.admin_claims_col_claimant(), width: 'w-56' },
  ];
  const relationLabels: Record<PlaceClaimRelation, () => string> = {
    owner: m.place_claim_role_owner,
    staff: m.place_claim_role_staff,
    organizer: m.place_claim_role_organizer,
  };

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  const approving = new Target<Row>();
  const rejecting = new Target<Row>();
  const items = (row: Row): KebabItem[] => [
    ...(row.status === 'pending' && !row.place.owned
      ? [
          {
            id: 'approve',
            label: m.admin_claims_approve_menu(),
            icon: 'check' as const,
            onselect: () => (approving.current = row),
          },
        ]
      : []),
    {
      id: 'open',
      label: m.admin_places_open(),
      icon: 'external-link',
      href: `/pp/${row.place.slug}`,
    },
    {
      id: 'profile',
      label: m.admin_claims_see_profile(),
      icon: 'user-id',
      href: `/u/${row.claimant.username}`,
    },
    ...(row.status === 'pending'
      ? [
          {
            id: 'reject',
            label: m.admin_claims_reject_menu(),
            icon: 'circle-x' as const,
            destructive: true,
            onselect: () => (rejecting.current = row),
          },
        ]
      : []),
  ];

  const statusOptions = $derived(
    PLACE_CLAIM_STATUSES.map((value) => ({
      value,
      label: {
        pending: m.admin_claims_filter_pending,
        approved: m.admin_claims_filter_approved,
        rejected: m.admin_claims_filter_rejected,
        all: m.admin_profile_all,
      }[value](),
    })),
  );
</script>

<AdminPage
  title={m.admin_claims_title()}
  lede={m.admin_claims_lede()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_nav_places(), href: '/admin/places' },
    { label: m.admin_claims_title() },
  ]}
>
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_claims_title()}
    total={list.total}
    totalLabel={m.admin_claims_total({ count: list.total })}
    page={list.page}
    pageSize={list.pageSize}
    filterKeys={['status', 'page']}
    filtered={list.status !== 'pending'}
    empty={m.admin_claims_empty()}
    sizes={false}
    menu={(row: Row) => ({
      name: m.admin_claims_action_label({ name: row.place.name }),
      items: items(row),
    })}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_partners_status()}
        options={statusOptions}
        value={list.status}
        fallback="pending"
      />
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'place'}
        <p class="truncate font-semibold">{row.place.name}</p>
        <p class="text-sm text-muted">{relationLabels[row.relation]()}</p>
        <div class="mt-1"><StatusBadge status={`claim:${row.status}` as Status} /></div>
        {#if row.note}
          <p class="mt-1 text-sm whitespace-pre-line">{row.note}</p>
        {/if}
        {#if row.decisionNote}
          <p class="mt-1 text-sm text-muted">
            {m.admin_claims_decision_note({ note: row.decisionNote })}
          </p>
        {/if}
      {:else if id === 'claimant'}
        <a class="anchor" href={`/u/${row.claimant.username}`}>@{row.claimant.username}</a>
        <p class="text-sm break-all">{row.contact}</p>
        <p class="text-sm text-muted tabular-nums">{shortDate(row.createdAt, locale)}</p>
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet title()}{row.place.name}{/snippet}
        {#snippet meta()}
          <p>@{row.claimant.username} · {relationLabels[row.relation]()}</p>
          <p class="break-all">{row.contact}</p>
          <p>{shortDate(row.createdAt, locale)}</p>
          {#if row.note}<p class="whitespace-pre-line">{row.note}</p>{/if}
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={`claim:${row.status}` as Status} />
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>

  {#if approving.current}
    {@const row = approving.current}
    {#key row.id}
      <ModerationDialog
        bind:open={approving.open}
        trigger={false}
        action="?/approve"
        schema={approveClaimSchema}
        fields={{ id: row.id }}
        label={m.admin_claims_approve()}
        title={m.admin_claims_approve_title({ name: row.place.name })}
        text={m.admin_claims_approve_text({ username: row.claimant.username ?? '' })}
        confirm={m.admin_claims_approve_confirm()}
        success={m.admin_claims_approve_done()}
      />
    {/key}
  {/if}
  {#if rejecting.current}
    {@const row = rejecting.current}
    {#key row.id}
      <ModerationDialog
        bind:open={rejecting.open}
        trigger={false}
        action="?/reject"
        schema={rejectClaimSchema}
        fields={{ id: row.id }}
        danger
        write={{
          name: 'note',
          label: m.admin_claims_reject_note(),
          hint: m.admin_claims_reject_note_hint({ max: RESOLUTION_NOTE_MAX }),
        }}
        label={m.admin_claims_reject()}
        title={m.admin_claims_reject_title({ name: row.place.name })}
        text={m.admin_claims_reject_text()}
        confirm={m.admin_claims_reject_confirm()}
        success={m.admin_claims_reject_done()}
      />
    {/key}
  {/if}
</AdminPage>
