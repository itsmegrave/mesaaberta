<script lang="ts">
  import UserLink from '$lib/components/UserLink.svelte';
  import { page } from '$app/state';
  import { createTable, FlexRender, tableFeatures, type ColumnDef } from '@tanstack/svelte-table';
  import { pageHref } from '$lib/admin/page-href';
  import { REPORT_FILTERS, type ReportFilter } from '$lib/admin/report-filters';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { reasonLabel, reportStatusLabel } from '$lib/moderation/labels';
  import { atHandle } from '$lib/profile/handle';
  import type { AdminReports } from '$lib/server/moderation/admin';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data }: { data: AdminReports } = $props();
  const locale = getLocale();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const features = tableFeatures({});
  type Report = AdminReports['rows'][number];

  const targetOf = (report: Report) =>
    report.targetType === 'table'
      ? m.admin_reports_target_table({ table: report.table })
      : report.player
        ? atHandle(report.player)
        : m.admin_profile_no_username();
  const columns: ColumnDef<typeof features, Report>[] = [
    {
      id: 'target',
      header: () => m.admin_reports_target(),
      cell: ({ row }) => targetOf(row.original),
    },
    {
      accessorKey: 'reason',
      header: () => m.report_reason(),
      cell: ({ row }) => reasonLabel(row.original.reason),
    },
    {
      accessorKey: 'status',
      header: () => m.admin_profile_status(),
      cell: ({ row }) => reportStatusLabel(row.original.status),
    },
    {
      accessorKey: 'createdAt',
      header: () => m.admin_reports_filed(),
      cell: ({ row }) => day.format(row.original.createdAt),
    },
  ];
  const table = createTable({
    features,
    columns,
    get data() {
      return data.rows;
    },
    getRowId: (row) => row.id,
  });

  const filterLabel = (filter: ReportFilter) =>
    ({
      waiting: m.admin_reports_filter_waiting,
      resolved: m.report_status_resolved,
      dismissed: m.report_status_dismissed,
      all: m.admin_profile_all,
    })[filter]();
  const filterHref = (filter: ReportFilter) =>
    localizedHref(
      filter === 'waiting' ? '/admin/reports' : `/admin/reports?status=${filter}`,
      locale,
    );
</script>

<section aria-labelledby="reports-title" class="mt-8">
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <h2 id="reports-title" class="sr-only">{m.admin_reports_title()}</h2>
    <nav aria-label={m.admin_reports_filter()} class="flex flex-wrap gap-2">
      {#each REPORT_FILTERS as filter (filter)}
        <a
          href={filterHref(filter)}
          aria-current={data.status === filter ? 'page' : undefined}
          class="chip h-11 rounded-full px-4 font-semibold {data.status === filter
            ? 'preset-filled-primary-500'
            : 'border border-surface-200-800 hover:preset-tonal'}">{filterLabel(filter)}</a
        >
      {/each}
    </nav>
    <p class="text-sm text-muted" aria-live="polite">
      {m.admin_reports_total({ count: data.total })}
    </p>
  </div>

  <div class="mt-5 overflow-x-auto rounded-lg border border-surface-200-800 bg-panel">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-surface-200-800">
        {#each table.getHeaderGroups() as group (group.id)}
          <tr>
            {#each group.headers as header (header.id)}
              <th scope="col" class="p-3 font-semibold"><FlexRender {header} /></th>
            {/each}
          </tr>
        {/each}
      </thead>
      <tbody class="divide-y divide-surface-200-800">
        {#each table.getRowModel().rows as row (row.id)}
          <tr class="hover:bg-surface-100-900">
            {#each row.getAllCells() as cell (cell.id)}
              <td class="wrap-break-word">
                {#if cell.column.id === 'target' && row.original.targetType !== 'table'}<span
                    class="block px-3 py-4 font-semibold"
                    ><UserLink
                      username={row.original.player}
                      label={row.original.player ? undefined : m.admin_profile_no_username()}
                    /></span
                  >{:else}<a
                    class="block px-3 py-4 {cell.column.id === 'target'
                      ? 'anchor font-semibold'
                      : ''}"
                    href={localizedHref(`/admin/reports/${row.original.id}`, locale)}
                    ><FlexRender {cell} /></a
                  >{/if}
              </td>
            {/each}
          </tr>
        {:else}
          <tr>
            <td colspan={columns.length} class="px-3 py-6 text-muted">{m.admin_reports_empty()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  {#if data.pages > 1}
    <nav
      aria-label={m.admin_pagination()}
      class="mt-4 flex flex-wrap items-center justify-end gap-3"
    >
      <span class="text-sm">{m.admin_profile_page({ page: data.page, pages: data.pages })}</span>
      {#if data.page > 1}
        <a
          class="btn size-11 rounded-lg border border-surface-200-800 p-0"
          href={pageHref('/admin/reports', page.url.searchParams, data.page - 1, locale)}
          aria-label={m.admin_profile_previous()}
          title={m.admin_profile_previous()}><Icon name="chevron-left" /></a
        >
      {/if}
      {#if data.page < data.pages}
        <a
          class="btn size-11 rounded-lg border border-surface-200-800 p-0"
          href={pageHref('/admin/reports', page.url.searchParams, data.page + 1, locale)}
          aria-label={m.admin_profile_next()}
          title={m.admin_profile_next()}><Icon name="chevron-right" /></a
        >
      {/if}
    </nav>
  {/if}
</section>
