<script lang="ts">
  import { navigating, page as current } from '$app/state';
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { shortDate } from '$lib/admin/format';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { pageQuery } from '$lib/query/page.svelte';
  import { PROFILE_STANDINGS } from '$lib/profile/standing';
  import { toast } from '$lib/toaster';
  import type { AdminProfilesView } from '$lib/server/reads/admin-users';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const profiles = $derived(data.profiles);
  type Profile = AdminProfilesView['rows'][number];

  const locale = getLocale();
  const columns: DataColumn[] = [
    { id: 'user', header: m.admin_profile_user(), sortable: true },
    { id: 'tables', header: m.admin_profile_tables(), width: 'w-56' },
    { id: 'joined', header: m.admin_profile_joined(), sortable: true, width: 'w-36' },
    { id: 'status', header: m.admin_profile_status(), width: 'w-40' },
    { id: 'actions', header: m.admin_profile_actions(), hideHeader: true, width: 'w-16' },
  ];
  const tablesOf = (row: Profile) => {
    const parts = [
      row.playing > 0 ? m.admin_profile_tables_playing({ count: row.playing }) : null,
      row.running > 0 ? m.admin_profile_tables_running({ count: row.running }) : null,
    ].filter((part) => part !== null);
    return parts.length > 0 ? parts.join(' · ') : m.admin_profile_tables_none();
  };
  const badge = (row: Profile) => `user:${row.standing}` as Status;
  const nameOf = (row: Profile) =>
    row.username ? `@${row.username}` : m.admin_profile_no_username();
  const detailsHref = (id: string) =>
    localizedHref(`/admin/users/${id}?${current.url.searchParams}`, locale);
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
  const options = $derived([
    { value: 'all', label: m.admin_profile_all(), count: profiles.counts.all },
    ...PROFILE_STANDINGS.map((value) => ({
      value,
      label: m[`status_user_${value}`](),
      count: profiles.counts[value],
    })),
  ]);
  const sort = $derived(profiles.sort);
  const sortLabel = $derived(
    sort.id === 'user' ? m.admin_profile_user() : m.admin_profile_joined(),
  );
</script>

<svelte:head><title>{m.admin_profile_list()} | Mesa Aberta</title></svelte:head>
<AdminPage title={m.admin_profile_list()} lede={m.admin_users_lede()}>
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />
  <DataTable
    rows={profiles.rows}
    {columns}
    rowId={(row: Profile) => row.id}
    caption={m.admin_profile_list()}
    total={profiles.total}
    totalLabel={m.admin_profile_total({ count: profiles.total })}
    page={profiles.page}
    pageSize={profiles.pageSize}
    {sort}
    {sortLabel}
    search={{ value: profiles.query, label: m.admin_profile_search(), maxlength: 100 }}
    filterKeys={['q', 'status', 'page']}
    filtered={!!profiles.query || profiles.status !== 'all'}
    empty={m.admin_profile_empty()}
    busy={remote.isFetching || !!navigating.to}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_profile_status()}
        {options}
        value={profiles.status}
      />
    {/snippet}
    {#snippet cell(row: Profile, id: string)}
      {#if id === 'user'}
        <div class="flex min-w-0 items-center gap-3">
          <Media kind="avatar" src={row.avatar} name={row.name ?? row.username} size={40} />
          <div class="min-w-0">
            <p class="truncate font-semibold">
              <UserLink
                username={row.username}
                label={row.username ? undefined : m.admin_profile_no_username()}
              />
            </p>
            <p class="truncate text-muted">{row.name ?? m.admin_profile_no_name()}</p>
          </div>
        </div>
      {:else if id === 'tables'}
        {tablesOf(row)}
      {:else if id === 'joined'}
        <span class="tabular-nums">{shortDate(row.createdAt, locale)}</span>
      {:else if id === 'status'}
        <StatusBadge status={badge(row)} />
      {:else if id === 'actions'}
        <KebabMenu name={nameOf(row)} items={menuOf(row)} />
      {/if}
    {/snippet}
    {#snippet card(row: Profile)}
      <ListCard>
        {#snippet media()}<Media
            kind="avatar"
            src={row.avatar}
            name={row.name ?? row.username}
            size={40}
          />{/snippet}
        {#snippet title()}
          <UserLink
            username={row.username}
            label={row.username ? undefined : m.admin_profile_no_username()}
          />
        {/snippet}
        {#snippet meta()}
          <p class="truncate">{row.name ?? m.admin_profile_no_name()}</p>
          <p>{tablesOf(row)}</p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
          <span class="text-sm text-muted">{shortDate(row.createdAt, locale)}</span>
        {/snippet}
        {#snippet action()}<KebabMenu name={nameOf(row)} items={menuOf(row)} />{/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
</AdminPage>
