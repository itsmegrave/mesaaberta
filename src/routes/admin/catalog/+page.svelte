<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import CatalogDialog from '$lib/components/admin/CatalogDialog.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import UserText from '$lib/components/UserText.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  const locale = getLocale();
  const number = new Intl.NumberFormat(locale);
  type Row = (typeof data.rows)[number];

  const columns: DataColumn[] = [
    { id: 'name', header: m.admin_catalog_name(), sortable: true },
    { id: 'origin', header: m.admin_catalog_origin(), width: 'w-56' },
    { id: 'uses', header: m.admin_catalog_uses(), sortable: true, align: 'right', width: 'w-28' },
    { id: 'status', header: m.admin_catalog_status(), width: 'w-40' },
    { id: 'actions', header: m.admin_catalog_actions(), hideHeader: true, width: 'w-16' },
  ];
  // A rejected entry is not shown as its own state: the admin sees it as disabled.
  const badge = (row: Row) =>
    `catalog:${row.status === 'rejected' ? 'disabled' : row.status}` as Status;
  const statuses = $derived([
    { value: 'all', label: m.admin_tables_all(), count: data.counts.all },
    { value: 'active', label: m.admin_catalog_status_approved(), count: data.counts.active },
    { value: 'disabled', label: m.admin_catalog_status_disabled(), count: data.counts.disabled },
  ]);

  // The row menu only picks; the dialog is mounted next to the table, so closing the menu does not
  // take it away.
  let chosen = $state<{ mode: 'merge' | 'disable' | 'rename'; row: Row } | null>(null);
  const menuOf = (row: Row): KebabItem[] => [
    {
      id: 'rename',
      label: m.admin_queue_rename(),
      icon: 'square-pen',
      onselect: () => (chosen = { mode: 'rename', row }),
    },
    {
      id: 'merge',
      label: m.admin_catalog_menu_merge(),
      icon: 'routing',
      onselect: () => (chosen = { mode: 'merge', row }),
    },
    ...(row.status === 'approved'
      ? [
          {
            id: 'disable',
            label: m.admin_catalog_menu_disable(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (chosen = { mode: 'disable', row }),
          },
        ]
      : []),
  ];
  const tab = '-mb-px inline-flex h-11 items-center border-b-2 px-3 font-semibold';
  const sortLabel = $derived(
    data.sort?.id === 'uses' ? m.admin_catalog_uses() : m.admin_catalog_name(),
  );
</script>

<svelte:head><title>{m.admin_catalog_title()} | Mesa Aberta</title></svelte:head>

<AdminPage title={m.admin_catalog_title()} lede={m.admin_catalog_lede()}>
  {#snippet actions()}
    <!-- A different catalog needs new defaults; refetches within the same kind preserve drafts. -->
    {#key data.kind}
      <CatalogDialog
        mode="create"
        kind={data.kind}
        label={data.kind === 'platform'
          ? m.admin_catalog_new_platform()
          : m.admin_catalog_new_tag()}
        triggerClass="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
      />
    {/key}
  {/snippet}

  <nav aria-label={m.admin_catalog_title()} class="mt-6 border-b border-surface-200-800">
    <ul class="flex gap-1">
      {#each [['platform', m.admin_catalog_tab_platforms()], ['tag', m.admin_catalog_tab_tags()]] as const as [kind, label] (kind)}
        <li>
          <a
            href={localizedHref(`/admin/catalog?kind=${kind}`, locale)}
            aria-current={data.kind === kind ? 'page' : undefined}
            class="{tab} {data.kind === kind
              ? 'border-primary-500'
              : 'border-transparent text-muted hover:text-inherit'}">{label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>

  <DataTable
    rows={data.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_catalog_title()}
    total={data.total}
    totalLabel={m.admin_catalog_total({ count: data.total })}
    page={data.page}
    pageSize={data.pageSize}
    sort={data.sort}
    {sortLabel}
    search={{ value: data.query, label: m.admin_catalog_search(), maxlength: 40 }}
    filterKeys={['q', 'status', 'page']}
    filtered={!!data.query || data.status !== 'all'}
    empty={m.admin_catalog_empty()}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_catalog_status()}
        options={statuses}
        value={data.status}
      />
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'name'}
        <p class="font-semibold">{row.name}</p>
        <p class="text-muted">{row.slug}</p>
      {:else if id === 'origin'}
        {#if row.suggestedBy}<UserText
            text={m.admin_catalog_origin_suggestion({ username: row.suggestedBy })}
            username={row.suggestedBy}
          />{:else}{m.admin_catalog_origin_catalog()}{/if}
      {:else if id === 'uses'}
        {number.format(row.uses)}
      {:else if id === 'status'}
        <StatusBadge status={badge(row)} />
      {:else if id === 'actions'}
        <KebabMenu name={row.name} items={menuOf(row)} />
      {/if}
    {/snippet}
    {#snippet card(row: Row)}
      <ListCard>
        {#snippet title()}{row.name}{/snippet}
        {#snippet meta()}
          <p class="truncate">{row.slug}</p>
          <p>
            {#if row.suggestedBy}<UserText
                text={m.admin_catalog_origin_suggestion({ username: row.suggestedBy })}
                username={row.suggestedBy}
              />{:else}{m.admin_catalog_origin_catalog()}{/if}
          </p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
          <span class="text-sm text-muted"
            >{m.admin_catalog_uses_phone({ count: number.format(row.uses) })}</span
          >
        {/snippet}
        {#snippet action()}<KebabMenu name={row.name} items={menuOf(row)} />{/snippet}
      </ListCard>
    {/snippet}
  </DataTable>

  {#if chosen}
    {#key `${chosen.mode}-${chosen.row.id}`}
      <CatalogDialog
        mode={chosen.mode}
        kind={data.kind}
        entry={chosen.row}
        candidates={data.approved}
        startOpen
        onclose={() => (chosen = null)}
      />
    {/key}
  {/if}
</AdminPage>
