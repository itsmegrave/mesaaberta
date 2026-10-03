<script lang="ts">
  import TextInput from '$lib/components/TextInput.svelte';
  import { PROFILE_STANDINGS } from '$lib/profile/standing';
  import Avatar from '$lib/components/Avatar.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import { toast } from '$lib/toaster';
  import Form from '$lib/components/Form.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
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
  import type { AdminProfilesView } from '$lib/server/reads/admin-users';
  import Icon from './Icon.svelte';
  import { m } from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data, busy = false }: { data: AdminProfilesView; busy?: boolean } = $props();
  const features = tableFeatures({ rowPaginationFeature });
  const locale = getLocale();
  type Profile = AdminProfilesView['rows'][number];
  const columns: ColumnDef<typeof features, Profile>[] = [
    { id: 'user', header: () => m.admin_profile_user() },
    { id: 'tables', header: () => m.admin_profile_tables() },
    { accessorKey: 'createdAt', header: () => m.admin_profile_joined() },
    { accessorKey: 'standing', header: () => m.admin_profile_status() },
    { id: 'actions', header: () => m.admin_profile_actions() },
  ];
  const joined = (date: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
  const tablesOf = (row: Profile) => {
    const parts = [
      row.playing > 0 ? m.admin_profile_tables_playing({ count: row.playing }) : null,
      row.running > 0 ? m.admin_profile_tables_running({ count: row.running }) : null,
    ].filter((part) => part !== null);
    return parts.length > 0 ? parts.join(' · ') : m.admin_profile_tables_none();
  };
  const badge = (row: Profile) => `user:${row.standing}` as Status;
  const detailsHref = (id: string) =>
    localizedHref(`/admin/users/${id}?${page.url.searchParams}`, locale);
  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(m.toast_id_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
  const menuOf = (row: Profile): KebabItem[] => [
    { id: 'details', label: m.admin_menu_details(), icon: 'eye', href: detailsHref(row.id) },
    ...(row.username
      ? [
          {
            id: 'public',
            label: m.admin_menu_public_profile(),
            icon: 'game-icons:meeple' as const,
            href: localizedHref(`/u/${encodeURIComponent(row.username)}`, locale),
          },
        ]
      : []),
    { id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: () => copyId(row.id) },
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
    <div class="w-52">
      <SearchSelect
        id="status-filter"
        name="status"
        label={m.admin_profile_status()}
        labelClass="text-sm font-semibold"
        class="grid gap-2"
        compact
        items={[
          { name: m.admin_profile_all(), slug: 'all' },
          ...PROFILE_STANDINGS.map((status) => ({
            name: m[`status_user_${status}`](),
            slug: status,
          })),
        ]}
        value={[data.status]}
        placeholder={m.admin_profile_all()}
      />
    </div>
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
  <div class="mt-5">
    <table class="w-full text-left text-sm max-md:block">
      <thead class="border-b border-surface-200-800 max-md:sr-only">
        {#each table.getHeaderGroups() as group (group.id)}
          <tr
            >{#each group.headers as header (header.id)}<th scope="col" class="p-3 font-semibold"
                ><FlexRender {header} /></th
              >{/each}</tr
          >
        {/each}
      </thead>
      <tbody class="divide-y divide-surface-200-800 max-md:block">
        {#each table.getRowModel().rows as row (row.id)}
          <tr
            class="hover:bg-surface-100-900 max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-between max-md:gap-x-3 max-md:px-1 max-md:py-3"
          >
            {#each row.getAllCells() as cell (cell.id)}
              {@const user = row.original}
              <td
                class="min-w-0 p-3 max-md:px-2 max-md:py-1 {cell.column.id === 'user' ||
                cell.column.id === 'tables'
                  ? 'max-md:basis-full'
                  : ''} {cell.column.id === 'createdAt' ? 'tabular-nums' : ''}"
              >
                {#if cell.column.id === 'user'}
                  <span class="flex min-w-0 items-center gap-3">
                    <Avatar src={user.avatar} name={user.name ?? user.username} size={40} />
                    <span class="min-w-0">
                      <span class="block truncate font-semibold">
                        <UserLink
                          username={user.username}
                          label={user.username ? undefined : m.admin_profile_no_username()}
                        />
                      </span>
                      <span class="block truncate text-sm text-muted"
                        >{user.name ?? m.admin_profile_no_name()}</span
                      >
                    </span>
                  </span>
                {:else if cell.column.id === 'tables'}
                  {tablesOf(user)}
                {:else if cell.column.id === 'createdAt'}
                  {joined(user.createdAt)}
                {:else if cell.column.id === 'standing'}
                  <StatusBadge status={badge(user)} />
                {:else if cell.column.id === 'actions'}
                  <KebabMenu
                    name={user.username ? `@${user.username}` : m.admin_profile_no_username()}
                    items={menuOf(user)}
                  />
                {/if}
              </td>
            {/each}
          </tr>
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
    <div class="w-48">
      <SearchSelect
        id="page-size"
        name="size"
        label={m.admin_profile_size()}
        labelClass="text-sm"
        class="flex items-center gap-2"
        compact
        items={[20, 50, 100].map((size) => ({ name: String(size), slug: String(size) }))}
        value={[String(data.pageSize)]}
        placeholder={String(data.pageSize)}
        disabled={busy}
        onchange={(picked) => {
          // The list also reports the size the page already has; only a new size starts over.
          const size = Number(picked[0] ?? data.pageSize);
          if (size !== data.pageSize) table.setPagination({ pageIndex: 0, pageSize: size });
        }}
      />
    </div>
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
