<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import { CROWDFUNDING_ADMIN_STATUSES } from '$lib/crowdfunding/admin-filters';
  import { periodLabel } from '$lib/crowdfunding/format';
  import { platformLabel, siteName, submissionLabel } from '$lib/crowdfunding/labels';
  import { phaseOf } from '$lib/crowdfunding/phase';
  import { localizedHref } from '$lib/i18n/locales';
  import {
    CROWDFUNDING_REPORT_REASONS,
    removeCrowdfundingSchema,
    RESOLUTION_NOTE_MAX,
  } from '$lib/moderation/reports';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { toast } from '$lib/toaster';
  import type { AdminCrowdfundings } from '$lib/server/crowdfunding/admin';

  type Row = AdminCrowdfundings['rows'][number] & { cover: string | null };
  let { data }: { data: { crowdfundings: AdminCrowdfundings & { rows: Row[] } } } = $props();
  const list = $derived(data.crowdfundings);

  const locale = getLocale();
  const columns: DataColumn[] = [
    { id: 'campaign', header: m.admin_crowdfunding_col_campaign() },
    { id: 'status', header: m.admin_crowdfunding_col_status(), width: 'w-52' },
    { id: 'sender', header: m.crowdfunding_sent_by_label(), width: 'w-40' },
    { id: 'reports', header: m.admin_crowdfunding_col_reports(), align: 'right', width: 'w-28' },
    { id: 'actions', header: m.admin_profile_actions(), hideHeader: true, width: 'w-16' },
  ];

  // The row menu only picks; the dialog is mounted next to the list, so closing the menu keeps it.
  let removing = $state<Row | null>(null);
  const badge = (row: Row) =>
    (row.removedAt ? 'crowdfunding:removed' : `crowdfunding:${phaseOf(row)}`) as Status;
  async function copyId(row: Row) {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success(m.toast_id_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
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
      href: localizedHref('/admin/reports', locale),
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
            onselect: () => (removing = row),
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

<svelte:head><title>{m.admin_nav_crowdfunding()} | Mesa Aberta</title></svelte:head>
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
    {#snippet sheet()}
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
          <a class="anchor" href={localizedHref(`/u/${row.submitter}`, locale)}>@{row.submitter}</a>
        {:else}
          {submissionLabel(null, row.importSource)}
        {/if}
      {:else if id === 'reports'}
        {row.reports}
      {:else if id === 'actions'}
        <KebabMenu
          name={m.admin_crowdfunding_action_label({ name: row.name })}
          items={items(row)}
        />
      {/if}
    {/snippet}
    {#snippet card(row: Row)}
      <ListCard>
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
        {#snippet action()}
          <KebabMenu
            name={m.admin_crowdfunding_action_label({ name: row.name })}
            items={items(row)}
          />
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>
  {#if removing}
    {#key removing.id}
      <ModerationDialog
        bind:open={() => removing !== null, (value) => !value && (removing = null)}
        trigger={false}
        action="?/remove"
        schema={removeCrowdfundingSchema}
        fields={{ id: removing.id }}
        danger
        reasons={CROWDFUNDING_REPORT_REASONS}
        write={{
          name: 'note',
          label: m.admin_crowdfunding_remove_note(),
          hint: m.admin_crowdfunding_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
        }}
        label={m.admin_crowdfunding_remove()}
        title={m.admin_crowdfunding_remove_title({ name: removing.name })}
        text={m.admin_crowdfunding_remove_text()}
        confirm={m.admin_crowdfunding_remove_confirm()}
        success={m.admin_crowdfunding_remove_done()}
      />
    {/key}
  {/if}
</AdminPage>
