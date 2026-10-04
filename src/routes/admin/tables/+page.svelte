<script lang="ts">
  import { navigating, page as current } from '$app/state';
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import FilterSelect from '$lib/components/admin/FilterSelect.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import PostStatus from '$lib/components/admin/PostStatus.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import { dayLabel, timeLabel } from '$lib/admin/format';
  import { instagramStatus } from '$lib/admin/instagram-status';
  import { publishTable } from '$lib/admin/publish-table';
  import { INSTAGRAM_FILTERS } from '$lib/admin/table-filters';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { pageQuery } from '$lib/query/page.svelte';
  import { closeTableByIdSchema, RESOLUTION_NOTE_MAX } from '$lib/moderation/reports';
  import { toast } from '$lib/toaster';
  import { TABLE_STATUSES } from '$lib/tables/status-values';
  import type { AdminTablesView } from '$lib/server/reads/admin-tables';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const tables = $derived(data.tables);
  type Row = AdminTablesView['rows'][number];

  const locale = getLocale();
  const columns: DataColumn[] = [
    { id: 'title', header: m.admin_tables_col_table(), sortable: true },
    { id: 'next', header: m.admin_tables_date(), sortable: true, width: 'w-40' },
    { id: 'seats', header: m.admin_tables_col_seats(), align: 'right', width: 'w-24' },
    { id: 'status', header: m.admin_tables_col_status(), width: 'w-56' },
    { id: 'actions', header: m.admin_tables_actions(), hideHeader: true, width: 'w-16' },
  ];
  // The sort order the list opens on has no parameter; "Mesa" orders by title.
  const sort = $derived(tables.sort.id === 'created' ? null : tables.sort);

  let publishing = $state<string | null>(null);
  // The row menu only picks; the dialog is mounted next to the list, so closing the menu keeps it.
  let closing = $state<Row | null>(null);
  const href = (row: Row) => localizedHref(`/tables/${row.slug}`, locale);
  async function copyLink(row: Row) {
    try {
      await navigator.clipboard.writeText(new URL(href(row), current.url.origin).href);
      toast.success(m.toast_link_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
  const canPublish = (row: Row) =>
    data.instagramAvailable &&
    row.status === 'active' &&
    row.startsAt.getTime() > Date.now() &&
    !['published', 'publishing', 'uncertain', 'queued', 'processing'].includes(
      row.instagramStatus ?? '',
    );
  const items = (row: Row): KebabItem[] => [
    { id: 'view', label: m.menu_view_table(), icon: 'eye', href: href(row) },
    {
      id: 'history',
      label: m.history_title(),
      icon: 'clock',
      href: localizedHref(`/admin/tables/${row.id}`, locale),
    },
    { id: 'copy', label: m.menu_copy_link(), icon: 'copy', onselect: () => void copyLink(row) },
    {
      id: 'publish',
      label: m.instagram_generate_publish(),
      icon: 'instagram',
      disabled: !canPublish(row) || publishing !== null,
      onselect: () => {
        publishing = row.id;
        void publishTable(row.id).finally(() => (publishing = null));
      },
    },
    ...(row.status === 'active'
      ? [
          {
            id: 'close',
            label: m.admin_tables_close(),
            icon: 'lock' as const,
            destructive: true,
            onselect: () => (closing = row),
          },
        ]
      : []),
  ];

  const instagramOptions = $derived(
    INSTAGRAM_FILTERS.map((value) => ({
      slug: value,
      name:
        value === 'all' ? m.admin_profile_all() : instagramStatus(value === 'none' ? null : value),
    })),
  );
  const statusOptions = $derived([
    { value: 'all', label: m.admin_tables_all(), count: tables.counts.all },
    ...TABLE_STATUSES.map((value) => ({
      value,
      label: m[`status_table_${value}`](),
      count: tables.counts[value],
    })),
  ]);
  const filtered = $derived(
    !!tables.query || tables.status !== 'all' || tables.instagram !== 'all',
  );
  const busy = $derived(remote.isFetching || !!navigating.to);
</script>

<svelte:head><title>{m.admin_tables()} | Mesa Aberta</title></svelte:head>
<AdminPage title={m.admin_tables()} lede={m.admin_tables_lede()}>
  {#snippet actions()}
    <Button
      size="custom"
      type="button"
      class="btn h-11 gap-2 rounded-lg preset-tonal-primary px-4"
      disabled={remote.isFetching}
      onclick={() => remote.refetch()}
      >{#if remote.isFetching}<Spinner />{:else}<Icon
          name="refresh-cw"
          size={18}
        />{/if}{m.admin_refresh()}</Button
    >
  {/snippet}
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />
  <DataTable
    rows={tables.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_tables()}
    total={tables.total}
    totalLabel={m.admin_tables_total({ count: tables.total })}
    page={tables.page}
    pageSize={tables.pageSize}
    {sort}
    sortLabel={tables.sort.id === 'next' ? m.admin_tables_sort_next() : m.admin_tables_col_table()}
    search={{ value: tables.query, label: m.admin_tables_search_label(), maxlength: 100 }}
    filterKeys={['q', 'status', 'instagram', 'page']}
    {filtered}
    empty={m.admin_tables_empty()}
    {busy}
  >
    {#snippet selects()}
      <FilterSelect
        id="instagram-filter"
        name="instagram"
        label={m.admin_instagram_filter()}
        options={instagramOptions}
        value={tables.instagram}
      />
    {/snippet}
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_profile_status()}
        options={statusOptions}
        value={tables.status}
      />
    {/snippet}
    {#snippet sheet()}
      <div class="grid gap-4">
        <SegmentedFilter
          name="status"
          label={m.admin_profile_status()}
          options={statusOptions}
          value={tables.status}
        />
        <FilterSelect
          id="instagram-filter-sheet"
          name="instagram"
          label={m.admin_instagram_filter()}
          options={instagramOptions}
          value={tables.instagram}
          class="w-full"
          inDialog
        />
      </div>
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'title'}
        <div class="flex items-center gap-3">
          <Media kind="cover" src={row.cover} />
          <div class="min-w-0">
            <a class="block truncate link-underline" href={href(row)}>{row.title}</a>
            <p class="truncate text-muted">
              {row.system} ·
              <a class="anchor" href={localizedHref(`/admin/users/${row.gmId}`, locale)}
                >@{row.gm}</a
              >
            </p>
          </div>
        </div>
      {:else if id === 'next'}
        <p class="font-semibold">{dayLabel(row.startsAt, locale, row.timezone)}</p>
        <p class="text-muted">{timeLabel(row.startsAt, locale, row.timezone)}</p>
      {:else if id === 'seats'}
        {m.admin_tables_seats({ taken: row.seats, capacity: row.capacity })}
      {:else if id === 'status'}
        <div class="grid justify-items-start gap-1">
          <StatusBadge status={`table:${row.status}` as Status} />
          <PostStatus status={row.instagramStatus} />
        </div>
      {:else if id === 'actions'}
        {#if publishing === row.id}<Spinner />{:else}
          <KebabMenu name={m.admin_tables_action_label({ title: row.title })} items={items(row)} />
        {/if}
      {/if}
    {/snippet}
    {#snippet card(row: Row)}
      <ListCard>
        {#snippet media()}<Media kind="cover" src={row.cover} />{/snippet}
        {#snippet title()}<a class="link-underline" href={href(row)}>{row.title}</a>{/snippet}
        {#snippet meta()}
          <p class="truncate">{m.admin_tables_gm_of({ system: row.system, gm: `@${row.gm}` })}</p>
          <p>
            {dayLabel(row.startsAt, locale, row.timezone)} · {timeLabel(
              row.startsAt,
              locale,
              row.timezone,
            )}
          </p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={`table:${row.status}` as Status} />
          <span class="text-sm text-muted"
            >{m.admin_tables_seats_phone({ taken: row.seats, capacity: row.capacity })}</span
          >
          <PostStatus status={row.instagramStatus} />
        {/snippet}
        {#snippet action()}
          <KebabMenu name={m.admin_tables_action_label({ title: row.title })} items={items(row)} />
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
  <p class="mt-4 max-w-2xl text-sm text-muted">{m.admin_tables_footnote()}</p>
  {#if closing}
    {#key closing.id}
      <ModerationDialog
        bind:open={() => closing !== null, (value) => !value && (closing = null)}
        trigger={false}
        action="?/close"
        schema={closeTableByIdSchema}
        fields={{ tableId: closing.id }}
        danger
        write={{
          name: 'note',
          label: m.moderation_close_table_note(),
          hint: m.moderation_close_table_hint({ max: RESOLUTION_NOTE_MAX }),
          required: true,
        }}
        label={m.admin_tables_close()}
        title={m.admin_report_close_table_title({ table: closing.title })}
        text={m.admin_tables_close_text()}
        confirm={m.admin_report_close_table()}
        success={m.admin_tables_close_done()}
      />
    {/key}
  {/if}
</AdminPage>
