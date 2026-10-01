<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    createTable,
    FlexRender,
    tableFeatures,
    rowPaginationFeature,
    type ColumnDef,
  } from '@tanstack/svelte-table';
  import type { AdminTables } from '$lib/server/admin/tables';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import AdminActionForm from './admin/AdminActionForm.svelte';
  import { instagramFeedback } from '$lib/admin/instagram-feedback';
  import { instagramStatus } from '$lib/admin/instagram-status';
  import Icon from './Icon.svelte';
  import { m } from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';

  let {
    data,
    busy = false,
    instagramAvailable = false,
  }: { data: AdminTables; busy?: boolean; instagramAvailable?: boolean } = $props();
  let menuOpen = $state<string | null>(null);
  let publishing = $state<string | null>(null);
  const features = tableFeatures({ rowPaginationFeature });
  const locale = getLocale();
  type TableRow = AdminTables['rows'][number];
  const columns: ColumnDef<typeof features, TableRow>[] = [
    { accessorKey: 'title', header: () => m.admin_tables_title() },
    { accessorKey: 'system', header: () => m.table_system() },
    { accessorKey: 'nextAt', header: () => m.admin_tables_date() },
    {
      accessorKey: 'status',
      header: () => m.admin_profile_status(),
      cell: ({ row }) => (row.original.status === 'active' ? m.admin_active() : m.admin_disabled()),
    },
    {
      accessorKey: 'instagramStatus',
      header: () => m.admin_tables_instagram(),
      cell: ({ row }) => instagramStatus(row.original.instagramStatus),
    },
    { id: 'actions', header: () => m.admin_tables_actions() },
  ];
  const pagination = $derived({ pageIndex: data.page - 1, pageSize: data.pageSize });
  const table = createTable({
    features,
    columns,
    get data() {
      return data.rows;
    },
    get rowCount() {
      return data.total;
    },
    getRowId: (row) => row.id,
    manualPagination: true,
    state: {
      get pagination() {
        return pagination;
      },
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      const url = new URL(page.url);
      url.searchParams.set('page', String(next.pageIndex + 1));
      url.searchParams.set('size', String(next.pageSize));
      void goto(localizedHref(`${url.pathname}${url.search}#tables`, locale), {
        keepFocus: true,
        noScroll: true,
      });
    },
  });
</script>

<section
  id="tables"
  class="mt-10 border-t border-surface-200-800 pt-8"
  aria-labelledby="tables-title"
  aria-busy={busy}
>
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <h2 id="tables-title" class="text-xl font-semibold">{m.admin_tables()}</h2>
    <p class="text-sm text-muted" aria-live="polite">
      {m.admin_profile_total({ count: data.total })}
    </p>
  </div>
  <form
    method="GET"
    action={page.url.pathname}
    class="mt-4 flex flex-wrap items-end gap-3"
    onsubmit={(event) => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const params = new URLSearchParams({
        q: String(values.get('q') ?? ''),
        status: String(values.get('status') ?? 'all'),
        size: String(data.pageSize),
      });
      void goto(localizedHref(`${page.url.pathname}?${params}#tables`, locale), {
        keepFocus: true,
        noScroll: true,
      });
    }}
  >
    <label class="min-w-0 flex-1 basis-64 text-sm font-semibold">
      {m.admin_tables_search()}
      <input
        class="mt-2 input h-11 w-full"
        type="search"
        name="q"
        maxlength="100"
        value={data.query}
      />
    </label>
    <label class="text-sm font-semibold">
      {m.admin_profile_status()}
      <select class="select mt-2 h-11 min-w-44" name="status" value={data.status}>
        <option value="all">{m.admin_tables_all()}</option>
        <option value="active">{m.admin_active()}</option>
        <option value="disabled">{m.admin_disabled()}</option>
      </select>
    </label>
    <button
      class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-4"
      type="submit"
      disabled={busy}><Icon name="search" size={18} />{m.admin_profile_apply()}</button
    >
    {#if data.query || data.status !== 'all'}
      <a
        class="inline-flex min-h-11 items-center anchor"
        href={localizedHref(`${page.url.pathname}#tables`, locale)}>{m.admin_profile_clear()}</a
      >
    {/if}
  </form>
  <div class="mt-5 overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-surface-200-800">
        {#each table.getHeaderGroups() as group (group.id)}
          <tr
            >{#each group.headers as header (header.id)}<th scope="col" class="p-3 font-semibold"
                ><FlexRender {header} /></th
              >{/each}</tr
          >
        {/each}
      </thead>
      <tbody class="divide-y divide-surface-200-800">
        {#each table.getRowModel().rows as row (row.id)}
          <tr class="hover:bg-surface-100-900"
            >{#each row.getAllCells() as cell (cell.id)}
              <td class="px-3 py-4 wrap-break-word">
                {#if cell.column.id === 'title'}
                  <a
                    class="anchor font-semibold"
                    href={localizedHref(`/tables/${row.original.slug}`, locale)}
                    >{row.original.title}</a
                  >
                {:else if cell.column.id === 'nextAt'}
                  {row.original.nextAt
                    ? new Intl.DateTimeFormat(locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: row.original.timezone,
                      }).format(new Date(row.original.nextAt))
                    : '—'}
                {:else if cell.column.id === 'actions'}
                  <Popover
                    open={menuOpen === row.id}
                    onOpenChange={(details) => (menuOpen = details.open ? row.id : null)}
                    positioning={{ placement: 'bottom-end', offset: { mainAxis: 4 } }}
                  >
                    <Popover.Trigger
                      class="btn h-11 gap-2 rounded-lg border border-surface-200-800 px-3"
                      aria-label={m.admin_tables_action_label({ title: row.original.title })}
                      aria-busy={publishing === row.id}
                    >
                      {#if publishing === row.id}<Icon
                          name="refresh-cw"
                          class="animate-spin"
                        />{/if}{m.admin_tables_actions()}<Icon name="chevron-down" size={18} />
                    </Popover.Trigger>
                    <Popover.Positioner class="z-40!">
                      <Popover.Content
                        class="w-64 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
                      >
                        <AdminActionForm
                          action="?/publish"
                          onbusy={(value) => (publishing = value ? row.id : null)}
                          onresult={(result) => {
                            menuOpen = null;
                            instagramFeedback(result);
                          }}
                        >
                          {#snippet children(pending)}
                            <input type="hidden" name="tableId" value={row.original.id} />
                            <button
                              type="submit"
                              class="btn min-h-11 w-full justify-start gap-2 rounded-lg px-3 text-left font-semibold hover:preset-tonal"
                              disabled={pending ||
                                !!publishing ||
                                !instagramAvailable ||
                                row.original.status !== 'active' ||
                                !row.original.nextAt ||
                                ['published', 'publishing', 'uncertain'].includes(
                                  row.original.instagramStatus ?? '',
                                )}
                              aria-busy={pending}
                            >
                              {#if pending}<Icon
                                  name="refresh-cw"
                                  class="animate-spin"
                                />{/if}{pending
                                ? m.instagram_publishing()
                                : m.instagram_generate_publish()}
                            </button>
                          {/snippet}
                        </AdminActionForm>
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover>
                {:else}<FlexRender {cell} />{/if}
              </td>
            {/each}</tr
          >
        {:else}
          <tr
            ><td colspan={columns.length} class="px-3 py-6 text-muted">{m.admin_tables_empty()}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
    <label class="flex items-center gap-2 text-sm">
      {m.admin_profile_size()}
      <select
        class="select h-11 w-20"
        value={data.pageSize}
        disabled={busy}
        onchange={(event) =>
          table.setPagination({ pageIndex: 0, pageSize: Number(event.currentTarget.value) })}
      >
        {#each [20, 50, 100] as size (size)}<option value={size}>{size}</option>{/each}
      </select>
    </label>
    <div class="flex items-center gap-3">
      <span class="text-sm" aria-live="polite"
        >{m.admin_profile_page({ page: data.page, pages: Math.max(1, table.getPageCount()) })}</span
      >
      <button
        class="btn size-11 rounded-lg border border-surface-200-800 p-0"
        type="button"
        aria-label={m.admin_profile_previous()}
        title={m.admin_profile_previous()}
        disabled={busy || !table.getCanPreviousPage()}
        onclick={() => table.previousPage()}><Icon name="chevron-left" /></button
      >
      <button
        class="btn size-11 rounded-lg border border-surface-200-800 p-0"
        type="button"
        aria-label={m.admin_profile_next()}
        title={m.admin_profile_next()}
        disabled={busy || !table.getCanNextPage()}
        onclick={() => table.nextPage()}><Icon name="chevron-right" /></button
      >
    </div>
  </div>
</section>
