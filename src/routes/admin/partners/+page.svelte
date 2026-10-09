<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import DataTable, { type DataColumn } from '$lib/components/admin/DataTable.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ListCard from '$lib/components/admin/ListCard.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import {
    approvePartnerSchema,
    PARTNER_REPORT_REASONS,
    removePartnerSchema,
    RESOLUTION_NOTE_MAX,
  } from '$lib/moderation/reports';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { PARTNER_ADMIN_STATUSES, PARTNER_BACKLINK_FILTERS } from '$lib/partners/admin-filters';
  import { networkIcons, networkLabels } from '$lib/profile/social-presentation';
  import { toast } from '$lib/toaster';
  import type { AdminPartners } from '$lib/server/partners/admin';

  type Row = AdminPartners['rows'][number] & { logo: string | null };
  let { data }: { data: { partners: AdminPartners & { rows: Row[] } } } = $props();
  const list = $derived(data.partners);

  const locale = getLocale();
  const columns: DataColumn[] = [
    { id: 'partner', header: m.admin_partners_col_partner() },
    { id: 'links', header: m.admin_partners_col_links(), width: 'w-40' },
    { id: 'backlink', header: m.admin_partners_col_backlink(), width: 'w-40' },
    { id: 'sender', header: m.admin_partners_col_sender(), width: 'w-40' },
    { id: 'reports', header: m.admin_partners_col_reports(), align: 'right', width: 'w-28' },
    { id: 'actions', header: m.admin_profile_actions(), hideHeader: true, width: 'w-16' },
  ];

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  let approving = $state<Row | null>(null);
  let removing = $state<Row | null>(null);
  const badge = (row: Row) =>
    (row.removedAt
      ? row.withdrawn
        ? 'partner:withdrawn'
        : 'partner:removed'
      : row.approvedAt
        ? 'partner:up'
        : 'partner:pending') as Status;
  // The icons of a row: the site first, then the networks.
  const icons = (row: Row) => [
    ...(row.siteUrl ? [{ network: 'website' as const, url: row.siteUrl }] : []),
    ...row.links,
  ];

  async function copyId(row: Row) {
    try {
      await navigator.clipboard.writeText(row.id);
      toast.success(m.toast_id_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
  const items = (row: Row): KebabItem[] => [
    ...(!row.removedAt && !row.approvedAt
      ? [
          {
            id: 'approve',
            label: m.admin_partners_approve_menu(),
            icon: 'check' as const,
            onselect: () => (approving = row),
          },
        ]
      : []),
    ...(row.siteUrl
      ? [
          {
            id: 'open',
            label: m.admin_partners_open_site(),
            icon: 'external-link' as const,
            href: row.siteUrl,
            external: true,
          },
        ]
      : []),
    ...(row.backlinkUrl
      ? [
          {
            id: 'check',
            label: m.admin_partners_check_backlink(),
            icon: 'external-link' as const,
            href: row.backlinkUrl,
            external: true,
          },
        ]
      : []),
    {
      id: 'reports',
      label: m.admin_partners_see_reports(),
      icon: 'flag',
      href: localizedHref('/admin/reports?target=partner', locale),
    },
    { id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: () => void copyId(row) },
    ...(row.removedAt
      ? []
      : [
          {
            id: 'remove',
            label: row.approvedAt ? m.admin_partners_remove_menu() : m.admin_partners_reject_menu(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (removing = row),
          },
        ]),
  ];

  const statusOptions = $derived(
    PARTNER_ADMIN_STATUSES.map((value) => ({
      value,
      label: {
        pending: m.admin_partners_filter_pending,
        up: m.admin_partners_filter_up,
        reported: m.admin_partners_filter_reported,
        removed: m.partner_status_removed,
        all: m.admin_profile_all,
      }[value](),
    })),
  );
  const backlinkOptions = $derived(
    PARTNER_BACKLINK_FILTERS.map((value) => ({
      value,
      label: {
        any: m.admin_profile_all,
        given: m.admin_partners_backlink_given,
        missing: m.admin_partners_backlink_missing,
      }[value](),
    })),
  );
</script>

<svelte:head><title>{m.admin_nav_partners()} | Mesa Aberta</title></svelte:head>
<AdminPage title={m.admin_nav_partners()} lede={m.admin_partners_lede()}>
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_nav_partners()}
    total={list.total}
    totalLabel={m.admin_partners_total({ count: list.total })}
    page={list.page}
    pageSize={list.pageSize}
    search={{ value: list.query, label: m.admin_partners_search_label(), maxlength: 100 }}
    filterKeys={['q', 'status', 'backlink', 'page']}
    filtered={!!list.query || list.status !== 'pending' || list.backlink !== 'any'}
    empty={m.admin_partners_empty()}
    sizes={false}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_partners_status()}
        options={statusOptions}
        value={list.status}
        fallback="pending"
      />
      <SegmentedFilter
        name="backlink"
        label={m.admin_partners_col_backlink()}
        options={backlinkOptions}
        value={list.backlink}
        fallback="any"
      />
    {/snippet}
    {#snippet sheet()}
      <SegmentedFilter
        name="status"
        label={m.admin_partners_status()}
        options={statusOptions}
        value={list.status}
        fallback="pending"
      />
      <SegmentedFilter
        name="backlink"
        label={m.admin_partners_col_backlink()}
        options={backlinkOptions}
        value={list.backlink}
        fallback="any"
      />
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'partner'}
        <div class="flex items-center gap-3">
          <Media kind="avatar" src={row.logo} name={row.name} />
          <div class="min-w-0">
            <p class="truncate font-semibold">{row.name}</p>
            {#if row.description}<p class="truncate text-muted">{row.description}</p>{/if}
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={badge(row)} />
              {#if row.couponCode}
                <span class="inline-flex items-center gap-1 text-sm text-muted">
                  <Icon name="ticket-percent" size={16} /><code class="font-mono"
                    >{row.couponCode}</code
                  >
                </span>
              {/if}
            </div>
          </div>
        </div>
      {:else if id === 'links'}
        <ul class="flex flex-wrap gap-2">
          {#each icons(row) as link (link.network + link.url)}
            <li>
              <!-- eslint-disable svelte/no-navigation-without-resolve -- the partner's own link on another site, not an app route -->
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted hover:text-surface-950-50"
                aria-label={m.partner_link_label({
                  network: networkLabels[link.network](),
                  name: row.name,
                })}
                title={networkLabels[link.network]()}
              >
                <Icon name={networkIcons[link.network]} size={18} />
              </a>
              <!-- eslint-enable svelte/no-navigation-without-resolve -->
            </li>
          {/each}
        </ul>
      {:else if id === 'backlink'}
        {#if row.backlinkUrl}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- where the partner put our link, on another site -->
          <a class="anchor" href={row.backlinkUrl} target="_blank" rel="noopener noreferrer"
            >{m.admin_partners_check()}<span class="sr-only"> {m.partner_opens_new_tab()}</span></a
          >
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {:else}
          <span class="text-warning-700-300">{m.admin_partners_not_informed()}</span>
        {/if}
      {:else if id === 'sender'}
        {#if row.submitter}
          <a class="anchor" href={localizedHref(`/u/${row.submitter}`, locale)}>@{row.submitter}</a>
        {/if}
      {:else if id === 'reports'}
        {row.reports}
      {:else if id === 'actions'}
        <KebabMenu name={m.admin_partners_action_label({ name: row.name })} items={items(row)} />
      {/if}
    {/snippet}
    {#snippet card(row: Row)}
      <ListCard>
        {#snippet media()}<Media kind="avatar" src={row.logo} name={row.name} />{/snippet}
        {#snippet title()}{row.name}{/snippet}
        {#snippet meta()}
          {#if row.description}<p class="truncate">{row.description}</p>{/if}
          <p>
            {row.submitter ? `@${row.submitter}` : ''} · {row.backlinkUrl
              ? m.admin_partners_backlink_given()
              : m.admin_partners_not_informed()}
          </p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
          {#if row.reports > 0}
            <span class="text-sm text-muted"
              >{m.admin_partners_reports_phone({ count: row.reports })}</span
            >
          {/if}
        {/snippet}
        {#snippet action()}
          <KebabMenu name={m.admin_partners_action_label({ name: row.name })} items={items(row)} />
        {/snippet}
      </ListCard>
    {/snippet}
  </DataTable>

  {#if approving}
    {#key approving.id}
      <ModerationDialog
        bind:open={() => approving !== null, (value) => !value && (approving = null)}
        trigger={false}
        action="?/approve"
        schema={approvePartnerSchema}
        fields={{ id: approving.id }}
        label={m.admin_partners_approve()}
        title={m.admin_partners_approve_title({ name: approving.name })}
        text={m.admin_partners_approve_text()}
        confirm={m.admin_partners_approve_confirm()}
        success={m.admin_partners_approve_done()}
      />
    {/key}
  {/if}
  {#if removing}
    {#key removing.id}
      <ModerationDialog
        bind:open={() => removing !== null, (value) => !value && (removing = null)}
        trigger={false}
        action="?/remove"
        schema={removePartnerSchema}
        fields={{ id: removing.id }}
        danger
        reasons={PARTNER_REPORT_REASONS}
        reasonTarget="partner"
        write={{
          name: 'note',
          label: m.admin_partners_remove_note(),
          hint: m.admin_partners_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
        }}
        label={m.admin_partners_remove()}
        title={m.admin_partners_remove_title({ name: removing.name })}
        text={m.admin_partners_remove_text()}
        confirm={m.admin_partners_remove_confirm()}
        success={m.admin_partners_remove_done()}
      />
    {/key}
  {/if}
</AdminPage>
