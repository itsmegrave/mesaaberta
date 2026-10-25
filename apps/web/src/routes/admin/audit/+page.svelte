<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import ListPanel from '#lib/components/admin/ListPanel.svelte';
  import ListSearch from '#lib/components/admin/ListSearch.svelte';
  import SegmentedFilter from '#lib/components/admin/SegmentedFilter.svelte';
  import UserText from '#lib/components/ui/UserText.svelte';
  import { dayLabel, timeLabel } from '#lib/admin/format.js';
  import { AUDIT_KINDS, type AuditKind } from '@mesaaberta/core/admin/report-filters';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import type { AuditLog } from '@mesaaberta/core/server/moderation/admin';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data } = $props();
  const locale = getLocale();
  const zone = $derived(data.viewer.timezone);
  const kindLabel = (kind: AuditKind) =>
    ({
      all: m.admin_audit_kind_all,
      reports: m.admin_audit_kind_reports,
      accounts: m.admin_audit_kind_accounts,
      tables: m.admin_audit_kind_tables,
      catalog: m.admin_audit_kind_catalog,
      announcements: m.admin_audit_kind_announcements,
    })[kind]();
  const kinds = AUDIT_KINDS.map((value) => ({ value, label: kindLabel(value) }));
  // The log is newest first, so the day headings follow the rows in order.
  const days = $derived.by(() => {
    const groups: { day: string; rows: AuditLog['rows'] }[] = [];
    for (const row of data.log.rows) {
      const day = dayLabel(row.at, locale, zone);
      const last = groups.at(-1);
      if (last?.day === day) last.rows.push(row);
      else groups.push({ day, rows: [row] });
    }
    return groups;
  });
  const filtered = $derived(data.log.kind !== 'all' || !!data.log.query);
  const handle = (username: string | null) =>
    username ? atHandle(username) : m.admin_profile_no_username();

  /** One line per decision, worded from the event: ids only in the record, names looked up. */
  function entryText(entry: AuditLog['rows'][number]) {
    const user = handle(entry.subject);
    const table = entry.title ?? entry.table ?? '';
    const name = entry.name ?? '';
    switch (entry.type) {
      case 'ReportReviewing':
        return m.audit_report_reviewing();
      case 'ReportResolved':
        return m.audit_report_resolved();
      case 'ReportDismissed':
        return m.audit_report_dismissed();
      case 'AccountBanned':
        return m.audit_account_banned({ user });
      case 'AccountReinstated':
        return m.audit_account_reinstated({ user });
      case 'AccountBanLifted':
        return m.audit_account_ban_lifted({ user });
      case 'TableClosedByModeration':
        return m.audit_table_closed({ table });
      case 'TableDisabled':
        return m.audit_table_disabled({ table });
      case 'PlayerLeft':
        return m.audit_player_removed({ user, table });
      case 'SystemAnnouncementSent':
        return m.audit_announcement({ title: table });
      case 'CatalogEntryCreated':
        return m.audit_catalog_created({ name });
      case 'CatalogEntryApproved':
        return m.audit_catalog_approved({ name });
      case 'CatalogEntryRejected':
        return m.audit_catalog_rejected({ name });
      case 'CatalogEntryRenamed':
        return m.audit_catalog_renamed({ name });
      case 'CatalogEntryMerged':
        return m.audit_catalog_merged({ name });
      case 'CatalogEntryDisabled':
        return m.audit_catalog_disabled({ name });
      case 'EventForced':
        return m.audit_event_forced({ type: entry.eventType ?? '' });
      default:
        return entry.type;
    }
  }
</script>

<AdminPage title={m.admin_audit_title()} lede={m.admin_audit_lede()}>
  <ListPanel
    label={m.admin_audit_title()}
    class="mt-6"
    total={data.log.total}
    totalLabel={m.admin_audit_total({ count: data.log.total })}
    page={data.log.page}
    pageSize={data.log.pageSize}
    pages={data.log.pages}
    empty={filtered ? m.admin_audit_filtered_empty() : m.admin_audit_empty()}
    {filtered}
  >
    {#snippet toolbar()}
      <div class="flex flex-wrap items-center gap-3">
        <ListSearch value={data.log.query} label={m.admin_audit_search()} />
        <p role="status" class="ml-auto text-sm font-semibold text-muted">
          {m.admin_audit_total({ count: data.log.total })}
        </p>
      </div>
      <SegmentedFilter
        name="kind"
        label={m.admin_audit_kind()}
        options={kinds}
        value={data.log.kind}
      />
    {/snippet}

    {#each days as group (group.day)}
      <h2 class="bg-surface-wash px-4 py-2 text-sm font-semibold text-muted">{group.day}</h2>
      <ol class="divide-y divide-surface-200-800">
        {#each group.rows as entry (entry.id)}
          <li class="flex min-h-17 items-start gap-4 px-4 py-3">
            <time
              datetime={entry.at.toISOString()}
              class="w-24 shrink-0 pt-0.5 text-sm text-muted tabular-nums"
              >{timeLabel(entry.at, locale, zone)}</time
            >
            <div class="min-w-0 flex-1">
              <p class="font-semibold wrap-break-word">
                <UserText text={entryText(entry)} username={entry.subject} />
                {#if entry.reportId}
                  <a
                    class="ml-1 anchor text-sm font-normal"
                    href={`/admin/reports/${entry.reportId}`}>{m.admin_audit_see_report()}</a
                  >
                {/if}
              </p>
              <p class="text-sm text-muted">
                {#if entry.by}<UserText
                    text={m.admin_decision_by({ username: entry.by })}
                    username={entry.by}
                  />{:else}{m.admin_decision_by_gone()}{/if}
              </p>
            </div>
          </li>
        {/each}
      </ol>
    {/each}
  </ListPanel>
</AdminPage>
