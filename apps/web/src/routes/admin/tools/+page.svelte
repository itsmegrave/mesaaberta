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
  import { removeTool } from '#lib/admin/moderation-presets.js';
  import { personMessages } from '#lib/admin/message-person.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toolHost, toolKindLabels } from '#lib/tools/labels.js';
  import {
    removeToolSchema,
    TOOL_ADMIN_STATUSES,
    toolIdSchema,
  } from '@mesaaberta/core/tools/schema';
  import type { AdminTools } from '@mesaaberta/core/server/tools/service';

  type Row = AdminTools['rows'][number] & { logo: string | null };
  let { data }: { data: { tools: AdminTools & { rows: Row[] } } } = $props();
  const list = $derived(data.tools);

  const columns: DataColumn[] = [
    { id: 'tool', header: m.admin_tools_col_tool() },
    { id: 'kind', header: m.admin_tools_col_kind(), width: 'w-40' },
    { id: 'site', header: m.admin_tools_col_site(), width: 'w-44' },
    { id: 'sender', header: m.admin_tools_col_sender(), width: 'w-44' },
  ];

  // The row menu only picks; the dialogs are mounted next to the list, so closing the menu keeps them.
  const approving = new Target<Row>();
  const removing = new Target<Row>();
  const badge = (row: Row) =>
    (row.removedAt ? 'tool:removed' : row.approvedAt ? 'tool:up' : 'tool:pending') as Status;

  function copyId(row: Row) {
    return copyText(row.id, m.toast_id_copied());
  }
  const messages = personMessages();
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
    ...(row.removedAt
      ? []
      : [
          {
            id: 'edit',
            label: m.admin_tools_edit_menu(),
            icon: 'square-pen' as const,
            href: `/admin/tools/${row.id}`,
          },
        ]),
    {
      id: 'open',
      label: m.admin_partners_open_site(),
      icon: 'external-link',
      href: row.siteUrl,
      external: true,
    },
    ...messages.item(row.submitterId),
    { id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: () => void copyId(row) },
    ...(row.removedAt
      ? []
      : [
          {
            id: 'remove',
            label: row.approvedAt ? m.admin_partners_remove_menu() : m.admin_tools_reject_menu(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (removing.current = row),
          },
        ]),
  ];

  const statusOptions = $derived(
    TOOL_ADMIN_STATUSES.map((value) => ({
      value,
      label: {
        all: m.admin_tools_filter_all,
        pending: m.partner_status_pending,
        up: m.partner_status_up,
        removed: m.admin_tools_filter_removed,
      }[value](),
    })),
  );
  const sender = (row: Row) => (row.submitterId ? `@${row.submitter}` : m.admin_tools_seed());
</script>

<AdminPage title={m.admin_nav_tools()} lede={m.admin_tools_lede()}>
  <DataTable
    rows={list.rows}
    {columns}
    rowId={(row: Row) => row.id}
    caption={m.admin_nav_tools()}
    total={list.total}
    totalLabel={m.admin_tools_total({ count: list.total })}
    page={1}
    pageSize={Math.max(list.total, 1)}
    search={{ value: list.query, label: m.admin_tools_search_label(), maxlength: 100 }}
    filterKeys={['q', 'status']}
    filtered={!!list.query || list.status !== 'all'}
    empty={m.admin_tools_empty()}
    sizes={false}
    menu={(row: Row) => ({
      name: m.admin_partners_action_label({ name: row.name }),
      items: items(row),
    })}
  >
    {#snippet segments()}
      <SegmentedFilter
        name="status"
        label={m.admin_partners_status()}
        options={statusOptions}
        value={list.status}
        fallback="all"
      />
    {/snippet}
    {#snippet cell(row: Row, id: string)}
      {#if id === 'tool'}
        <div class="flex items-center gap-3">
          <Media kind="avatar" src={row.logo} name={row.name} />
          <div class="min-w-0">
            <p class="truncate font-semibold">{row.name}</p>
            <p class="truncate text-muted">{row.description}</p>
            <div class="mt-1"><StatusBadge status={badge(row)} /></div>
          </div>
        </div>
      {:else if id === 'kind'}
        {toolKindLabels[row.kind]()}
      {:else if id === 'site'}
        <!-- eslint-disable svelte/no-navigation-without-resolve -- the tool's own site, not an app route -->
        <a
          class="block truncate anchor"
          href={row.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          >{toolHost(row.siteUrl)}<span class="sr-only"> {m.tool_opens_new_tab()}</span></a
        >
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {:else if id === 'sender'}
        {#if row.submitterId && row.submitter}
          <a class="anchor" href={`/u/${row.submitter}`}>@{row.submitter}</a>
        {:else}
          <span class="text-muted">{sender(row)}</span>
        {/if}
      {/if}
    {/snippet}
    {#snippet card(row: Row, action: Snippet | undefined)}
      <ListCard {action}>
        {#snippet media()}<Media kind="avatar" src={row.logo} name={row.name} />{/snippet}
        {#snippet title()}{row.name}{/snippet}
        {#snippet meta()}
          <p class="truncate">{row.description}</p>
          <p>{toolKindLabels[row.kind]()} · {toolHost(row.siteUrl)}</p>
          <p>{sender(row)}</p>
        {/snippet}
        {#snippet badges()}
          <StatusBadge status={badge(row)} />
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
        schema={toolIdSchema}
        fields={{ id: row.id }}
        label={m.admin_tools_approve()}
        title={m.admin_partners_approve_title({ name: row.name })}
        text={m.admin_tools_approve_text()}
        confirm={m.admin_partners_approve_confirm()}
        success={m.admin_tools_approve_done()}
      />
    {/key}
  {/if}
  {#if removing.current}
    {@const row = removing.current}
    {#key row.id}
      <ModerationDialog
        bind:open={removing.open}
        trigger={false}
        action="?/remove"
        schema={removeToolSchema}
        fields={{ id: row.id }}
        {...removeTool(row.name, !!row.approvedAt)}
      />
    {/key}
  {/if}
</AdminPage>
