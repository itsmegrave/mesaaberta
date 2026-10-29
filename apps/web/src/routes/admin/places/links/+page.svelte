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
    approvePartnerLinkSchema,
    PARTNER_LINK_STATUSES,
    rejectPartnerLinkSchema,
  } from '@mesaaberta/core/places/partner-links';
  import type { AdminPartnerLinks } from '@mesaaberta/core/server/places/partner-links';

  // A place asking to show a partner ("Parceiro Mesa Aberta"), asked by someone who looks after both.
  type Row = AdminPartnerLinks['rows'][number];
  let { data }: { data: { links: AdminPartnerLinks } } = $props();
  const list = $derived(data.links);
  const locale = getLocale();

  const columns: DataColumn[] = [
    { id: 'link', header: m.admin_links_col_link() },
    { id: 'requester', header: m.admin_links_col_requester(), width: 'w-56' },
  ];
  // Links share the claims' states: waiting, approved, rejected.
  const status = (row: Row) => `claim:${row.status}` as Status;

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  const approving = new Target<Row>();
  const rejecting = new Target<Row>();
  const items = (row: Row): KebabItem[] => [
    ...(row.status === 'pending'
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
      id: 'place',
      label: m.admin_places_open(),
      icon: 'external-link',
      href: `/pp/${row.place.slug}`,
    },
    {
      id: 'partner',
      label: m.admin_links_open_partner(),
      icon: 'external-link',
      href: `/p/${row.partner.id}`,
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
    PARTNER_LINK_STATUSES.map((value) => ({
      value,
      label: {
        pending: m.admin_claims_filter_pending,
        approved: m.admin_claims_filter_approved,
        rejected: m.admin_claims_filter_rejected,
        all: m.admin_profile_all,
      }[value](),
    })),
  );
  const who = (row: Row) => (row.requester?.username ? `@${row.requester?.username}` : '—');
</script>

<AdminPage
  title={m.admin_links_title()}
  lede={m.admin_links_lede()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_nav_places(), href: '/admin/places' },
    { label: m.admin_links_title() },
  ]}
>
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_links_title()}
    total={list.total}
    totalLabel={m.admin_links_total({ count: list.total })}
    page={list.page}
    pageSize={list.pageSize}
    filterKeys={['status', 'page']}
    filtered={list.status !== 'pending'}
    empty={m.admin_links_empty()}
    sizes={false}
    menu={(row: Row) => ({
      name: m.admin_links_action_label({ place: row.place.name, partner: row.partner.name }),
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
      {#if id === 'link'}
        <p class="truncate font-semibold">{row.place.name}</p>
        <p class="truncate text-sm text-muted">
          {m.admin_links_partner({ name: row.partner.name })}
        </p>
        <div class="mt-1"><StatusBadge status={status(row)} /></div>
        {#if row.decisionNote}
          <p class="mt-1 text-sm text-muted">
            {m.admin_claims_decision_note({ note: row.decisionNote })}
          </p>
        {/if}
      {:else if id === 'requester'}
        {#if row.requester?.username}
          <a class="anchor" href={`/u/${row.requester?.username}`}>{who(row)}</a>
        {:else}
          <p>{who(row)}</p>
        {/if}
        <p class="text-sm text-muted tabular-nums">{shortDate(row.createdAt, locale)}</p>
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet title()}{row.place.name}{/snippet}
        {#snippet meta()}
          <p>{m.admin_links_partner({ name: row.partner.name })}</p>
          <p>{who(row)} · {shortDate(row.createdAt, locale)}</p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={status(row)} />
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
        schema={approvePartnerLinkSchema}
        fields={{ id: row.id }}
        label={m.admin_claims_approve()}
        title={m.admin_links_approve_title({ place: row.place.name, partner: row.partner.name })}
        text={m.admin_links_approve_text()}
        confirm={m.admin_claims_approve_confirm()}
        success={m.admin_links_approve_done()}
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
        schema={rejectPartnerLinkSchema}
        fields={{ id: row.id }}
        danger
        write={{
          name: 'note',
          label: m.admin_claims_reject_note(),
          hint: m.admin_claims_reject_note_hint({ max: RESOLUTION_NOTE_MAX }),
        }}
        label={m.admin_claims_reject()}
        title={m.admin_links_reject_title({ place: row.place.name, partner: row.partner.name })}
        text={m.admin_claims_reject_text()}
        confirm={m.admin_claims_reject_confirm()}
        success={m.admin_links_reject_done()}
      />
    {/key}
  {/if}
</AdminPage>
