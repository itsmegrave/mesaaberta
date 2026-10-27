<script lang="ts">
  import type { Snippet } from 'svelte';
  import { copyText } from '#lib/clipboard.js';
  import { Target } from '#lib/target.svelte.js';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '#lib/components/admin/DataTable.svelte';
  import ListCard from '#lib/components/admin/ui/ListCard.svelte';
  import Media from '#lib/components/admin/ui/Media.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import SegmentedFilter from '#lib/components/admin/SegmentedFilter.svelte';
  import type { KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import StatusBadge, { type Status } from '#lib/components/ui/StatusBadge.svelte';
  import { shortDate } from '#lib/admin/format.js';
  import { removePlace } from '#lib/admin/moderation-presets.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { placeArea, placeKindIcons, placeKindLabels, placeTagLabel } from '#lib/places/labels.js';
  import { formatCep } from '@mesaaberta/core/location/cep';
  import {
    approvePlaceSchema,
    removePlaceSchema,
    restorePlaceSchema,
    RESOLUTION_NOTE_MAX,
  } from '@mesaaberta/core/moderation/reports';
  import { PLACE_ADMIN_STATUSES } from '@mesaaberta/core/places/admin-filters';
  import { placeOwnerSchema } from '@mesaaberta/core/places/claims';
  import { placeTags } from '@mesaaberta/core/places/tags';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import type { AdminPlaces } from '@mesaaberta/core/server/places/admin';

  type Row = AdminPlaces['rows'][number] & { image: string | null };
  let { data }: { data: { places: AdminPlaces & { rows: Row[] } } } = $props();
  const list = $derived(data.places);
  const locale = getLocale();

  const columns: DataColumn[] = [
    { id: 'place', header: m.admin_places_col_place() },
    { id: 'kind', header: m.admin_places_col_kind(), width: 'w-36' },
    { id: 'sender', header: m.admin_places_col_sender(), width: 'w-40' },
    { id: 'reports', header: m.admin_places_col_reports(), align: 'right', width: 'w-24' },
  ];

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  const approving = new Target<Row>();
  const removing = new Target<Row>();
  const restoring = new Target<Row>();
  const unowning = new Target<Row>();
  const hidden = (row: Row) => !!row.hiddenAt && !row.removedAt;
  const badge = (row: Row) =>
    (row.removedAt
      ? 'place:removed'
      : row.hiddenAt
        ? 'place:hidden'
        : row.approvedAt
          ? 'place:up'
          : 'place:pending') as Status;
  const street = (row: Row) =>
    [row.street, row.complement].filter(Boolean).join(', ') + ` · ${formatCep(row.postalCode)}`;
  // What approving gives it: the tags its kind, address and amenities make, as /places shows them.
  const tagsOf = (row: Row) => placeTags(row).map(placeTagLabel).join(', ');

  function copyId(row: Row) {
    return copyText(row.id, m.toast_id_copied());
  }
  const items = (row: Row): KebabItem[] => [
    ...(!row.removedAt && !row.approvedAt
      ? [
          {
            id: 'approve',
            label: m.admin_places_approve_menu(),
            icon: 'check' as const,
            onselect: () => (approving.current = row),
          },
        ]
      : []),
    ...(hidden(row)
      ? [
          {
            id: 'restore',
            label: m.admin_places_restore_menu(),
            icon: 'refresh-cw' as const,
            onselect: () => (restoring.current = row),
          },
        ]
      : []),
    ...(row.removedAt
      ? []
      : [
          {
            id: 'open',
            label: m.admin_places_open(),
            icon: 'external-link' as const,
            href: `/pp/${row.slug}`,
          },
          {
            id: 'edit',
            label: m.admin_places_edit(),
            icon: 'square-pen' as const,
            href: `/pp/${row.slug}/edit`,
          },
        ]),
    {
      id: 'reports',
      label: m.admin_places_see_reports(),
      icon: 'flag',
      href: '/admin/reports?target=place',
    },
    { id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: () => void copyId(row) },
    ...(row.owned && !row.removedAt
      ? [
          {
            id: 'remove-owner',
            label: m.admin_places_remove_owner_menu(),
            icon: 'circle-x' as const,
            destructive: true,
            onselect: () => (unowning.current = row),
          },
        ]
      : []),
    ...(row.removedAt
      ? []
      : [
          {
            id: 'remove',
            label: row.approvedAt ? m.admin_places_remove_menu() : m.admin_places_reject_menu(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (removing.current = row),
          },
        ]),
  ];

  const statusOptions = $derived(
    PLACE_ADMIN_STATUSES.map((value) => ({
      value,
      label: {
        pending: m.admin_partners_filter_pending,
        up: m.admin_partners_filter_up,
        reported: m.admin_partners_filter_reported,
        removed: m.partner_status_removed,
        all: m.admin_profile_all,
      }[value](),
    })),
  );
</script>

<AdminPage title={m.admin_nav_places()} lede={m.admin_places_lede()}>
  {#snippet actions()}
    <a href="/admin/places/claims" class="{buttonClass('secondary', 'sm')} font-semibold"
      >{m.admin_claims_title()}</a
    >
  {/snippet}
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_nav_places()}
    total={list.total}
    totalLabel={m.admin_places_total({ count: list.total })}
    page={list.page}
    pageSize={list.pageSize}
    search={{ value: list.query, label: m.admin_places_search_label(), maxlength: 100 }}
    filterKeys={['q', 'status', 'page']}
    filtered={!!list.query || list.status !== 'pending'}
    empty={m.admin_places_empty()}
    sizes={false}
    menu={(row: Row) => ({
      name: m.admin_places_action_label({ name: row.name }),
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
        <div class="flex items-center gap-3">
          <Media kind="cover" src={row.image} icon={placeKindIcons[row.kind]} />
          <div class="min-w-0">
            <p class="truncate font-semibold">{row.name}</p>
            <p class="truncate text-muted">{placeArea(row)}</p>
            <p class="truncate text-sm text-muted">{street(row)}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={badge(row)} />
              {#if hidden(row)}
                <span class="text-sm font-semibold text-error-700-300"
                  >{m.admin_places_high_priority()}</span
                >
              {/if}
            </div>
          </div>
        </div>
      {:else if id === 'kind'}
        {placeKindLabels[row.kind]()}
      {:else if id === 'sender'}
        {#if row.submitter}
          <a class="anchor" href={`/u/${row.submitter}`}>@{row.submitter}</a>
        {:else}
          <span class="text-muted">{m.admin_places_no_sender()}</span>
        {/if}
        <p class="text-sm text-muted tabular-nums">{shortDate(row.createdAt, locale)}</p>
      {:else if id === 'reports'}
        {row.reports}
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet media()}<Media
            kind="cover"
            src={row.image}
            icon={placeKindIcons[row.kind]}
          />{/snippet}
        {#snippet title()}{row.name}{/snippet}
        {#snippet meta()}
          <p>{placeKindLabels[row.kind]()} · {placeArea(row)}</p>
          <p class="truncate">{street(row)}</p>
          <p>
            {row.submitter ? `@${row.submitter}` : m.admin_places_no_sender()} · {shortDate(
              row.createdAt,
              locale,
            )}
          </p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
          {#if hidden(row)}
            <span class="text-sm font-semibold text-error-700-300"
              >{m.admin_places_high_priority()}</span
            >
          {/if}
          {#if row.reports > 0}
            <span class="text-sm text-muted"
              >{m.admin_partners_reports_phone({ count: row.reports })}</span
            >
          {/if}
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
        schema={approvePlaceSchema}
        fields={{ id: row.id }}
        label={m.admin_places_approve()}
        title={m.admin_places_approve_title({ name: row.name })}
        text={m.admin_places_approve_text({ tags: tagsOf(row) })}
        confirm={m.admin_places_approve_confirm()}
        success={m.admin_places_approve_done()}
      />
    {/key}
  {/if}
  {#if restoring.current}
    {@const row = restoring.current}
    {#key row.id}
      <ModerationDialog
        bind:open={restoring.open}
        trigger={false}
        action="?/restore"
        schema={restorePlaceSchema}
        fields={{ id: row.id }}
        write={{
          name: 'note',
          label: m.admin_places_restore_note(),
          hint: m.admin_places_restore_note_hint({ max: RESOLUTION_NOTE_MAX }),
        }}
        label={m.admin_places_restore()}
        title={m.admin_places_restore_title({ name: row.name })}
        text={m.admin_places_restore_text({ count: row.reports })}
        confirm={m.admin_places_restore_confirm()}
        success={m.admin_places_restore_done()}
      />
    {/key}
  {/if}
  {#if unowning.current}
    {@const row = unowning.current}
    {#key row.id}
      <ModerationDialog
        bind:open={unowning.open}
        trigger={false}
        action="?/removeOwner"
        schema={placeOwnerSchema}
        fields={{ id: row.id }}
        danger
        label={m.admin_places_remove_owner()}
        title={m.admin_places_remove_owner_title({ name: row.name })}
        text={m.admin_places_remove_owner_text()}
        confirm={m.admin_places_remove_owner_confirm()}
        success={m.admin_places_remove_owner_done()}
      />
    {/key}
  {/if}
  {#if removing.current}
    {@const row = removing.current}
    {#key row.id}
      <ModerationDialog
        bind:open={removing.open}
        trigger={false}
        action="?/remove"
        schema={removePlaceSchema}
        fields={{ id: row.id }}
        {...removePlace(row.name, !!row.approvedAt)}
      />
    {/key}
  {/if}
</AdminPage>
