<script lang="ts">
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import UserText from '$lib/components/UserText.svelte';
  import { page } from '$app/state';
  import { pageHref } from '$lib/admin/page-href';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { atHandle } from '$lib/profile/handle';
  import type { AuditLog } from '$lib/server/moderation/admin';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const locale = getLocale();
  const when = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: data.viewer.timezone,
    }).format(value);
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
      default:
        return entry.type;
    }
  }
</script>

<svelte:head><title>{m.admin_audit_title()} | Mesa Aberta</title></svelte:head>

<section class="py-6 md:py-10">
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_audit_title() }]}
    class="mb-6"
  />
  <AdminPageHead title={m.admin_audit_title()} lede={m.admin_audit_lede()} />

  {#if data.log.rows.length === 0}
    <p class="mt-8 rounded-lg border border-surface-200-800 bg-panel p-6" role="status">
      {m.admin_audit_empty()}
    </p>
  {:else}
    <ol class="mt-8 grid max-w-3xl gap-4">
      {#each data.log.rows as entry (entry.id)}
        <li class="border-l-2 border-surface-200-800 pl-4">
          <p class="font-semibold wrap-break-word">
            <UserText text={entryText(entry)} username={entry.subject} />
            {#if entry.reportId}
              <a
                class="ml-1 anchor text-sm font-normal"
                href={localizedHref(`/admin/reports/${entry.reportId}`, locale)}
                >{m.admin_audit_see_report()}</a
              >
            {/if}
          </p>
          <p class="text-sm text-muted">
            {#if entry.by}<UserText
                text={m.admin_decision_by({ username: entry.by })}
                username={entry.by}
              />{:else}{m.admin_decision_by_gone()}{/if} ·
            <time datetime={entry.at.toISOString()}>{when(entry.at)}</time>
          </p>
        </li>
      {/each}
    </ol>
  {/if}

  {#if data.log.pages > 1}
    <nav
      aria-label={m.admin_pagination()}
      class="mt-6 flex max-w-3xl flex-wrap items-center justify-end gap-3"
    >
      <span class="text-sm"
        >{m.admin_profile_page({ page: data.log.page, pages: data.log.pages })}</span
      >
      {#if data.log.page > 1}
        <a
          class="btn size-11 rounded-lg border border-surface-200-800 p-0"
          href={pageHref('/admin/audit', page.url.searchParams, data.log.page - 1, locale)}
          aria-label={m.admin_profile_previous()}
          title={m.admin_profile_previous()}><Icon name="chevron-left" /></a
        >
      {/if}
      {#if data.log.page < data.log.pages}
        <a
          class="btn size-11 rounded-lg border border-surface-200-800 p-0"
          href={pageHref('/admin/audit', page.url.searchParams, data.log.page + 1, locale)}
          aria-label={m.admin_profile_next()}
          title={m.admin_profile_next()}><Icon name="chevron-right" /></a
        >
      {/if}
    </nav>
  {/if}
</section>
