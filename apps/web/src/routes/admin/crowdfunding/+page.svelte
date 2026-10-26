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
  import { CROWDFUNDING_ADMIN_STATUSES } from '@mesaaberta/core/crowdfunding/admin-filters';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { periodLabel } from '#lib/crowdfunding/format.js';
  import { platformLabel, siteName, submissionLabel } from '#lib/crowdfunding/labels.js';
  import { phaseOf } from '@mesaaberta/core/crowdfunding/phase';
  import { removeCrowdfundingSchema } from '@mesaaberta/core/moderation/reports';
  import { removeCrowdfunding } from '#lib/admin/moderation-presets.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import type { AdminCrowdfundings } from '@mesaaberta/core/server/crowdfunding/admin';

  type Row = AdminCrowdfundings['rows'][number] & { cover: string | null };
  let { data }: { data: { crowdfundings: AdminCrowdfundings & { rows: Row[] } } } = $props();
  const list = $derived(data.crowdfundings);

  const locale = getLocale();
  const columns: DataColumn[] = [
    { id: 'campaign', header: m.admin_crowdfunding_col_campaign() },
    { id: 'status', header: m.admin_crowdfunding_col_status(), width: 'w-52' },
    { id: 'sender', header: m.crowdfunding_sent_by_label(), width: 'w-40' },
    { id: 'reports', header: m.admin_crowdfunding_col_reports(), align: 'right', width: 'w-28' },
  ];

  // The row menu only picks; the dialog is mounted next to the list, so closing the menu keeps it.
  const removing = new Target<Row>();
  const badge = (row: Row) =>
    (row.removedAt ? 'crowdfunding:removed' : `crowdfunding:${phaseOf(row)}`) as Status;
  function copyId(row: Row) {
    return copyText(row.id, m.toast_id_copied());
  }
  const items = (row: Row): KebabItem[] => [
    {
      id: 'open',
      label: m.admin_crowdfunding_open_link(),
      icon: 'external-link',
      href: row.url,
      external: true,
    },
    {
      id: 'reports',
      label: m.admin_crowdfunding_see_reports(),
      icon: 'flag',
      href: '/admin/reports',
    },
    { id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: () => void copyId(row) },
    ...(row.removedAt
      ? []
      : [
          {
            id: 'remove',
            label: m.admin_crowdfunding_remove_menu(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (removing.current = row),
          },
        ]),
  ];
  const options = $derived(
    CROWDFUNDING_ADMIN_STATUSES.map((value) => ({
      value,
      label: {
        up: m.admin_crowdfunding_filter_up,
        removed: m.crowdfunding_status_removed,
        all: m.admin_profile_all,
      }[value](),
    })),
  );
</script>

<AdminPage title={m.admin_nav_crowdfunding()} lede={m.admin_crowdfunding_lede()}>
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_nav_crowdfunding()}
    total={list.total}
    totalLabel={m.admin_crowdfunding_total({ count: list.total })}
    page={list.page}
    pageSize={list.pageSize}
    search={{ value: list.query, label: m.admin_crowdfunding_search_label(), maxlength: 100 }}
    filterKeys={['q', 'status', 'page']}
    filtered={!!list.query || list.status !== 'up'}
    empty={m.admin_crowdfunding_empty()}
    sizes={false}
    sheet
    menu={(row: Row) => ({
      name: m.admin_crowdfunding_action_label({ name: row.name }),
      items: items(row),
    })}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_profile_status()}
        {options}
        value={list.status}
        fallback="up"
      />
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'campaign'}
        <div class="flex items-center gap-3">
          <Media kind="cover" src={row.cover} icon="game-icons:open-treasure-chest" />
          <div class="min-w-0">
            <!-- The link a member shared: it leaves the site, so it opens apart and says so. -->
            <!-- eslint-disable svelte/no-navigation-without-resolve -- the campaign's own page on another site, not an app route -->
            <a
              class="block truncate link-underline"
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              >{row.name}<span class="sr-only">
                {m.crowdfunding_opens_new_tab({ site: siteName(row.platform, row.url) })}</span
              ></a
            >
            <!-- eslint-enable svelte/no-navigation-without-resolve -->
            <p class="truncate text-muted">{row.owner} · {platformLabel(row.platform)}</p>
          </div>
        </div>
      {:else if id === 'status'}
        <div class="grid justify-items-start gap-1">
          <StatusBadge status={badge(row)} />
          <p class="text-muted">{periodLabel(row.startsOn, row.endsOn, locale)}</p>
        </div>
      {:else if id === 'sender'}
        {#if row.submitter}
          <a class="anchor" href={`/u/${row.submitter}`}>@{row.submitter}</a>
        {:else}
          <span class="inline-flex items-center gap-2 text-muted">
            <Icon name="import" size={18} class="shrink-0" />
            {submissionLabel(null, row.importSource)}
          </span>
        {/if}
      {:else if id === 'reports'}
        {row.reports}
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet media()}<Media
            kind="cover"
            src={row.cover}
            icon="game-icons:open-treasure-chest"
          />{/snippet}
        {#snippet title()}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- the campaign's own page on another site, not an app route -->
          <a class="link-underline" href={row.url} target="_blank" rel="noopener noreferrer"
            >{row.name}<span class="sr-only">
              {m.crowdfunding_opens_new_tab({ site: siteName(row.platform, row.url) })}</span
            ></a
          >
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/snippet}
        {#snippet meta()}
          <p class="truncate">{row.owner} · {platformLabel(row.platform)}</p>
          <p>
            {periodLabel(row.startsOn, row.endsOn, locale)} · {submissionLabel(
              row.submitter,
              row.importSource,
            )}
          </p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
          {#if row.reports > 0}
            <span class="text-sm text-muted"
              >{m.admin_crowdfunding_reports_phone({ count: row.reports })}</span
            >
          {/if}
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
  {#if removing.current}
    {@const row = removing.current}
    {#key row.id}
      <ModerationDialog
        bind:open={removing.open}
        trigger={false}
        action="?/remove"
        schema={removeCrowdfundingSchema}
        fields={{ id: row.id }}
        {...removeCrowdfunding(row.name)}
      />
    {/key}
  {/if}
</AdminPage>
