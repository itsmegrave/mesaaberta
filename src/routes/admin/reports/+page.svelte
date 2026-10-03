<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import FilterSelect from '$lib/components/admin/FilterSelect.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { dayLabel, timeLabel } from '$lib/admin/format';
  import { REPORT_FILTERS, type ReportFilter } from '$lib/admin/report-filters';
  import { localizedHref } from '$lib/i18n/locales';
  import { reasonLabel } from '$lib/moderation/labels';
  import { atHandle } from '$lib/profile/handle';
  import type { AdminReports } from '$lib/server/moderation/admin';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data }: { data: { reports: AdminReports } } = $props();
  const reports = $derived(data.reports);
  type Report = AdminReports['rows'][number];

  const locale = getLocale();
  const zone = $derived(shownTimezone('America/Sao_Paulo'));
  const columns: DataColumn[] = [
    { id: 'target', header: m.admin_reports_col_target() },
    { id: 'reason', header: m.report_reason(), width: 'w-44' },
    { id: 'reporter', header: m.admin_reports_col_reporter(), width: 'w-40' },
    { id: 'filed', header: m.admin_reports_filed(), sortable: true, width: 'w-40' },
    { id: 'status', header: m.admin_profile_status(), width: 'w-36' },
    { id: 'actions', header: m.admin_profile_actions(), hideHeader: true, width: 'w-16' },
  ];

  const isTable = (row: Report) => row.targetType === 'table';
  const targetOf = (row: Report) =>
    isTable(row)
      ? m.admin_reports_target_table({ table: row.table })
      : row.player
        ? atHandle(row.player)
        : m.admin_profile_no_username();
  const href = (row: Report) => localizedHref(`/admin/reports/${row.id}`, locale);
  const badge = (row: Report) => `report:${row.status}` as Status;
  const menuOf = (row: Report): KebabItem[] => [
    { id: 'open', label: m.admin_reports_open(), icon: 'eye', href: href(row) },
  ];
  const label = (filter: ReportFilter) =>
    ({
      waiting: m.admin_reports_filter_waiting,
      resolved: m.report_status_resolved,
      dismissed: m.report_status_dismissed,
      all: m.admin_profile_all,
    })[filter]();
  const options = $derived(
    REPORT_FILTERS.map((value) => ({
      value,
      label: label(value),
      count: reports.counts[value],
    })),
  );
  const targets = [
    { slug: 'all', name: m.admin_reports_target_all() },
    { slug: 'table', name: m.admin_reports_target_table_option() },
    { slug: 'player', name: m.admin_reports_target_player_option() },
  ];
</script>

<svelte:head><title>{m.admin_reports_title()} | Mesa Aberta</title></svelte:head>
<AdminPage title={m.admin_reports_title()} lede={m.admin_reports_lede()}>
  <DataTable
    rows={reports.rows}
    {columns}
    rowId={(row: Report) => row.id}
    caption={m.admin_reports_title()}
    total={reports.total}
    totalLabel={m.admin_reports_total({ count: reports.total })}
    page={reports.page}
    pageSize={reports.pageSize}
    sort={reports.sort}
    sortLabel={m.admin_reports_filed()}
    filterKeys={['status', 'target', 'page']}
    filtered={reports.status !== 'waiting' || reports.target !== 'all'}
    empty={m.admin_reports_empty()}
  >
    {#snippet selects()}
      <FilterSelect
        id="target-filter"
        name="target"
        label={m.admin_reports_target_filter()}
        options={targets}
        value={reports.target}
      />
    {/snippet}
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_reports_filter()}
        {options}
        value={reports.status}
        fallback="waiting"
      />
    {/snippet}
    {#snippet sheet()}
      <div class="grid gap-4">
        <SegmentedFilter
          name="status"
          label={m.admin_reports_filter()}
          {options}
          value={reports.status}
          fallback="waiting"
        />
        <FilterSelect
          id="target-filter-sheet"
          name="target"
          label={m.admin_reports_target_filter()}
          options={targets}
          value={reports.target}
          class="w-full"
          inDialog
        />
      </div>
    {/snippet}
    {#snippet cell(row: Report, id: string)}
      {#if id === 'target'}
        <div class="flex items-center gap-3">
          <Media kind="icon" icon={isTable(row) ? 'game-icons:tavern-sign' : 'game-icons:meeple'} />
          <div class="min-w-0">
            {#if isTable(row)}
              <a class="block truncate link-underline" href={href(row)}>{targetOf(row)}</a>
              <p class="truncate text-muted">
                {m.admin_reports_gm_context({ gm: atHandle(row.gm) })}
              </p>
            {:else}
              <p class="truncate font-semibold">
                <UserLink
                  username={row.player}
                  label={row.player ? undefined : m.admin_profile_no_username()}
                />
              </p>
              <p class="truncate text-muted">
                <a class="anchor" href={href(row)}>{m.admin_reports_open()}</a>
              </p>
            {/if}
          </div>
        </div>
      {:else if id === 'reason'}
        {reasonLabel(row.reason)}
      {:else if id === 'reporter'}
        <UserLink username={row.reporter} />
      {:else if id === 'filed'}
        <p class="font-semibold">{dayLabel(row.createdAt, locale, zone)}</p>
        <p class="text-muted">{timeLabel(row.createdAt, locale, zone)}</p>
      {:else if id === 'status'}
        <StatusBadge status={badge(row)} />
      {:else if id === 'actions'}
        <KebabMenu
          name={m.admin_reports_action_label({ target: targetOf(row) })}
          items={menuOf(row)}
        />
      {/if}
    {/snippet}
    {#snippet card(row: Report)}
      <ListCard>
        {#snippet media()}<Media
            kind="icon"
            icon={isTable(row) ? 'game-icons:tavern-sign' : 'game-icons:meeple'}
          />{/snippet}
        {#snippet title()}<a class="link-underline" href={href(row)}>{targetOf(row)}</a>{/snippet}
        {#snippet meta()}
          <p class="truncate">
            {reasonLabel(row.reason)} · {m.admin_reports_by({ reporter: atHandle(row.reporter) })}
          </p>
          <p>{dayLabel(row.createdAt, locale, zone)} · {timeLabel(row.createdAt, locale, zone)}</p>
        {/snippet}
        {#snippet badges()}<StatusBadge status={badge(row)} />{/snippet}
        {#snippet action()}
          <KebabMenu
            name={m.admin_reports_action_label({ target: targetOf(row) })}
            items={menuOf(row)}
          />
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
</AdminPage>
