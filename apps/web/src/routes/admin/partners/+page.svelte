<script lang="ts">
  import type { Snippet } from 'svelte';
  import { copyText } from '#lib/clipboard.js';
  import { Target } from '#lib/target.svelte.js';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import DataTable, {
    type DataColumn,
    type FilterPlace,
  } from '#lib/components/admin/DataTable.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ListCard from '#lib/components/admin/ui/ListCard.svelte';
  import Media from '#lib/components/admin/ui/Media.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import SegmentedFilter from '#lib/components/admin/SegmentedFilter.svelte';
  import type { KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import StatusBadge, { type Status } from '#lib/components/ui/StatusBadge.svelte';
  import { approvePartnerSchema, removePartnerSchema } from '@mesaaberta/core/moderation/reports';
  import { removePartner } from '#lib/admin/moderation-presets.js';
  import { m } from '#lib/paraglide/messages.js';
  import FilterSelect from '#lib/components/admin/FilterSelect.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { partnerTypeLabels, partnerTypeOptions } from '#lib/partners/type-labels.js';
  import PartnerTypesDialog from './components/PartnerTypesDialog.svelte';

  import {
    PARTNER_ADMIN_STATUSES,
    PARTNER_BACKLINK_FILTERS,
  } from '@mesaaberta/core/partners/admin-filters';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';
  import type { AdminPartners } from '@mesaaberta/core/server/partners/admin';

  type Row = AdminPartners['rows'][number] & { logo: string | null };
  let { data }: { data: { partners: AdminPartners & { rows: Row[] } } } = $props();
  const list = $derived(data.partners);

  const columns: DataColumn[] = [
    { id: 'partner', header: m.admin_partners_col_partner() },
    { id: 'types', header: m.admin_partners_col_types(), width: 'w-32' },
    { id: 'links', header: m.admin_partners_col_links(), width: 'w-24' },
    { id: 'backlink', header: m.admin_partners_col_backlink(), width: 'w-28' },
    { id: 'sender', header: m.admin_partners_col_sender(), width: 'w-40' },
    { id: 'reports', header: m.admin_partners_col_reports(), align: 'right', width: 'w-24' },
  ];

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  const approving = new Target<Row>();
  const removing = new Target<Row>();
  const typing = new Target<Row>();
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

  function copyId(row: Row) {
    return copyText(row.id, m.toast_id_copied());
  }
  const items = (row: Row): KebabItem[] => [
    ...(!row.removedAt && !row.approvedAt
      ? [
          {
            id: 'approve',
            label: m.admin_partners_approve_menu(),
            icon: 'check' as const,
            onselect: () => (approving.current = row),
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
    ...(row.removedAt
      ? []
      : [
          {
            id: 'types',
            label: m.admin_partners_edit_types_menu(),
            icon: 'category' as const,
            onselect: () => (typing.current = row),
          },
        ]),
    {
      id: 'reports',
      label: m.admin_partners_see_reports(),
      icon: 'flag',
      href: '/admin/reports?target=partner',
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
            onselect: () => (removing.current = row),
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
  // "Todos" opens the list; "Sem tipo" finds the partners sent before there were kinds.
  const typeOptions = $derived([
    { slug: 'all', name: m.admin_profile_all() },
    ...partnerTypeOptions().map(({ value, label }) => ({ slug: value, name: label })),
    { slug: 'none', name: m.admin_partners_no_type() },
  ]);
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
    filterKeys={['q', 'status', 'type', 'backlink', 'page']}
    filtered={!!list.query ||
      list.status !== 'all' ||
      list.type !== null ||
      list.backlink !== 'any'}
    empty={m.admin_partners_empty()}
    sizes={false}
    sheet
    menu={(row: Row) => ({
      name: m.admin_partners_action_label({ name: row.name }),
      items: items(row),
    })}
  >
    {#snippet selects({ inSheet }: FilterPlace)}
      <FilterSelect
        id={inSheet ? 'type-filter-sheet' : 'type-filter'}
        name="type"
        label={m.partner_type_filter()}
        options={typeOptions}
        value={list.type ?? 'all'}
        fallback="all"
        class={inSheet ? 'w-full' : 'w-56'}
        inDialog={inSheet}
      />
    {/snippet}
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_partners_status()}
        options={statusOptions}
        value={list.status}
        fallback="all"
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
      {:else if id === 'types'}
        {#if row.types.length > 0}
          <ul class="flex flex-wrap gap-2" aria-label={m.partner_types_label({ name: row.name })}>
            {#each row.types as type (type)}
              <li><Pill tone="muted">{partnerTypeLabels[type]()}</Pill></li>
            {/each}
          </ul>
        {:else}
          <span class="text-muted">{m.admin_partners_no_type()}</span>
        {/if}
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
          <span class="text-lamp">{m.admin_partners_not_informed()}</span>
        {/if}
      {:else if id === 'sender'}
        {#if row.owners.length > 0}
          <p class="wrap-break-word">
            {#each row.owners as owner, index (owner)}{#if index > 0},
              {/if}<a class="anchor" href={`/u/${owner}`}>@{owner}</a>{/each}
          </p>
        {/if}
        {#if row.pendingInvites > 0}
          <p class="text-sm text-muted">
            {m.admin_partners_pending_invites({ count: row.pendingInvites })}
          </p>
        {/if}
        {#if row.contactEmail}
          <!-- eslint-disable svelte/no-navigation-without-resolve -- a mail address, not a page -->
          <a
            class="flex min-w-0 items-center gap-1 anchor text-sm text-muted"
            href="mailto:{row.contactEmail}"
            title={m.admin_partners_contact_email()}
            ><Icon name="mail" size={16} class="shrink-0" /><span class="truncate"
              >{row.contactEmail}</span
            ></a
          >
          <!-- eslint-enable svelte/no-navigation-without-resolve -->
        {/if}
      {:else if id === 'reports'}
        {row.reports}
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet media()}<Media kind="avatar" src={row.logo} name={row.name} />{/snippet}
        {#snippet title()}{row.name}{/snippet}
        {#snippet meta()}
          {#if row.description}<p class="truncate">{row.description}</p>{/if}
          <p>
            {row.types.length > 0
              ? row.types.map((type) => partnerTypeLabels[type]()).join(' · ')
              : m.admin_partners_no_type()}
          </p>
          <p>
            {row.owners.map((owner) => `@${owner}`).join(', ')}{row.contactEmail
              ? ` · ${row.contactEmail}`
              : ''} · {row.backlinkUrl
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
      </ListCard>
    {/snippet}
  </DataTable>

  {#if approving.current}
    {@const row = approving.current}
    {#key row.id}
      <ModerationDialog
        bind:open={approving.open}
        trigger={false}
        action="?/approve"
        schema={approvePartnerSchema}
        fields={{ id: row.id }}
        label={m.admin_partners_approve()}
        title={m.admin_partners_approve_title({ name: row.name })}
        text={m.admin_partners_approve_text()}
        confirm={m.admin_partners_approve_confirm()}
        success={m.admin_partners_approve_done()}
      />
    {/key}
  {/if}
  {#if typing.current}
    {@const row = typing.current}
    {#key row.id}
      <PartnerTypesDialog partner={row} bind:open={typing.open} />
    {/key}
  {/if}
  {#if removing.current}
    {@const row = removing.current}
    {#key row.id}
      <ModerationDialog
        bind:open={removing.open}
        trigger={false}
        action="?/remove"
        schema={removePartnerSchema}
        fields={{ id: row.id }}
        {...removePartner(row.name)}
      />
    {/key}
  {/if}
</AdminPage>
