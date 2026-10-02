<script lang="ts">
  import TextInput from '$lib/components/TextInput.svelte';
  import { PROFILE_STATUSES } from '$lib/profile/status';
  import Form from '$lib/components/Form.svelte';
  import SelectInput from '$lib/components/SelectInput.svelte';
  import Button from '$lib/components/Button.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    createTable,
    FlexRender,
    tableFeatures,
    rowPaginationFeature,
    type ColumnDef,
  } from '@tanstack/svelte-table';
  import type { AdminProfiles } from '$lib/server/admin/profiles';
  import Icon from './Icon.svelte';
  import { m } from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data, busy = false }: { data: AdminProfiles; busy?: boolean } = $props();
  const features = tableFeatures({ rowPaginationFeature });
  const locale = getLocale();
  type Profile = AdminProfiles['rows'][number];
  const columns: ColumnDef<typeof features, Profile>[] = [
    { accessorKey: 'id', header: () => m.admin_profile_id() },
    {
      accessorKey: 'username',
      header: () => m.admin_profile_username(),
      cell: ({ row }) => row.original.username ?? m.admin_profile_no_username(),
    },
    {
      accessorKey: 'status',
      header: () => m.admin_profile_status(),
      cell: ({ row }) =>
        row.original.status === 'active' ? m.admin_profile_active() : m.admin_profile_suspended(),
    },
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
      void goto(localizedHref(`${url.pathname}${url.search}#profiles`, locale), {
        keepFocus: true,
        noScroll: true,
      });
    },
  });
</script>

<section
  id="profiles"
  class="mt-10 border-t border-surface-200-800 pt-8"
  aria-labelledby="profiles-title"
  aria-busy={busy}
>
  <div class="flex flex-wrap items-baseline justify-between gap-3">
    <h2 id="profiles-title" class="text-xl font-semibold">{m.admin_profile_list()}</h2>
    <p class="text-sm text-muted" aria-live="polite">
      {m.admin_profile_total({ count: data.total })}
    </p>
  </div>
  <Form
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
      void goto(localizedHref(`${page.url.pathname}?${params}#profiles`, locale), {
        keepFocus: true,
        noScroll: true,
      });
    }}
  >
    <label class="min-w-0 flex-1 basis-64 text-sm font-semibold">
      {m.admin_profile_search()}
      <TextInput
        class="mt-2 input h-11 w-full"
        type="search"
        name="q"
        maxlength={100}
        value={data.query}
      />
    </label>
    <label class="text-sm font-semibold">
      {m.admin_profile_status()}
      <SelectInput class="select mt-2 h-11 min-w-44" name="status" value={data.status}>
        <option value="all">{m.admin_profile_all()}</option>
        {#each PROFILE_STATUSES as status (status)}
          <option value={status}
            >{status === 'active' ? m.admin_profile_active() : m.admin_profile_suspended()}</option
          >
        {/each}
      </SelectInput>
    </label>
    <Button
      size="custom"
      class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-4"
      type="submit"
      disabled={busy}><Icon name="search" size={18} />{m.admin_profile_apply()}</Button
    >
    {#if data.query || data.status !== 'all'}
      <a
        class="inline-flex min-h-11 items-center anchor"
        href={localizedHref(`${page.url.pathname}#profiles`, locale)}>{m.admin_profile_clear()}</a
      >
    {/if}
  </Form>
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
              <td
                class={cell.column.id === 'id' ? 'font-mono text-xs break-all' : 'wrap-break-word'}
                >{#if cell.column.id === 'username'}<span class="block px-3 py-4 font-semibold"
                    ><UserLink
                      username={row.original.username}
                      label={row.original.username ? undefined : m.admin_profile_no_username()}
                    /></span
                  >{:else}<a
                    class="block px-3 py-4"
                    href={localizedHref(
                      `/admin/users/${row.original.id}?${page.url.searchParams}`,
                      locale,
                    )}><FlexRender {cell} /></a
                  >{/if}</td
              >
            {/each}</tr
          >
        {:else}
          <tr
            ><td colspan={columns.length} class="px-3 py-6 text-muted">{m.admin_profile_empty()}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  </div>
  <div class="mt-4 flex flex-wrap items-center justify-between gap-4">
    <label class="flex items-center gap-2 text-sm">
      {m.admin_profile_size()}
      <SelectInput
        class="select h-11 w-20"
        value={data.pageSize}
        disabled={busy}
        onchange={(event) =>
          table.setPagination({ pageIndex: 0, pageSize: Number(event.currentTarget.value) })}
      >
        {#each [20, 50, 100] as size (size)}<option value={size}>{size}</option>{/each}
      </SelectInput>
    </label>
    <div class="flex items-center gap-3">
      <span class="text-sm" aria-live="polite"
        >{m.admin_profile_page({ page: data.page, pages: Math.max(1, table.getPageCount()) })}</span
      >
      <Button
        size="custom"
        class="btn size-11 rounded-lg border border-surface-200-800 p-0"
        type="button"
        aria-label={m.admin_profile_previous()}
        title={m.admin_profile_previous()}
        disabled={busy || !table.getCanPreviousPage()}
        onclick={() => table.previousPage()}><Icon name="chevron-left" /></Button
      >
      <Button
        size="custom"
        class="btn size-11 rounded-lg border border-surface-200-800 p-0"
        type="button"
        aria-label={m.admin_profile_next()}
        title={m.admin_profile_next()}
        disabled={busy || !table.getCanNextPage()}
        onclick={() => table.nextPage()}><Icon name="chevron-right" /></Button
      >
    </div>
  </div>
</section>
