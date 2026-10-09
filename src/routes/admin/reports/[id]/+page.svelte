<script lang="ts">
  import UserLink from '$lib/components/UserLink.svelte';
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import { siteName, submissionLabel } from '$lib/crowdfunding/labels';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { reasonLabel } from '$lib/moderation/labels';
  import {
    banFromReportSchema,
    closeReportSchema,
    closeTableSchema,
    CROWDFUNDING_REPORT_REASONS,
    PARTNER_REPORT_REASONS,
    removeCrowdfundingSchema,
    removePartnerSchema,
    reportIdSchema,
    RESOLUTION_NOTE_MAX,
  } from '$lib/moderation/reports';
  import { atHandle } from '$lib/profile/handle';
  import { networkIcons, networkLabels } from '$lib/profile/social-presentation';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const locale = getLocale();
  const report = $derived(data.report);
  const when = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: data.viewer.timezone,
    }).format(value);
  const handle = (username: string | null) =>
    username ? atHandle(username) : m.admin_profile_no_username();
  const kind = $derived(report.report.targetType);
  const isTable = $derived(kind === 'table');
  const campaign = $derived(report.crowdfunding);
  const partner = $derived(report.partner);
  const target = $derived(
    kind === 'crowdfunding'
      ? (campaign?.name ?? m.admin_report_crowdfunding_gone())
      : kind === 'partner'
        ? (partner?.name ?? m.admin_report_partner_gone())
        : isTable
          ? m.admin_reports_target_table({ table: report.table?.title ?? '' })
          : handle(report.player?.username ?? null),
  );
  const fields = $derived({ id: report.report.id });
  const note = {
    name: 'note' as const,
    label: m.moderation_note(),
    hint: m.moderation_note_hint({ max: RESOLUTION_NOTE_MAX }),
  };

  const ghost =
    'btn h-12 w-full rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
  const primary = 'btn h-12 w-full rounded-lg preset-filled-primary-500 px-4 font-semibold';
  const danger =
    'btn h-12 w-full rounded-lg border-2 border-surface-200-800 px-4 font-semibold text-error-700-300 hover:preset-tonal-error';
  const row = 'grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4';
</script>

<svelte:head><title>{m.admin_report_title()} | Mesa Aberta</title></svelte:head>

<AdminPage
  title={target}
  eyebrow={m.admin_report_eyebrow({ date: when(report.report.createdAt) })}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_reports_title(), href: '/admin/reports' },
    { label: m.admin_report_title() },
  ]}
>
  {#snippet status()}
    <p class="flex flex-wrap items-center gap-3">
      <StatusBadge status={`report:${report.report.status}` as Status} />
      <span class="text-sm text-muted">
        {kind === 'crowdfunding'
          ? m.admin_report_kind_crowdfunding()
          : kind === 'partner'
            ? m.admin_report_kind_partner()
            : isTable
              ? m.admin_report_kind_table()
              : m.admin_report_kind_player()} · {reasonLabel(report.report.reason, kind)}
      </span>
    </p>
  {/snippet}

  <div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div class="grid content-start gap-6">
      <section
        aria-labelledby="report-what"
        class="rounded-lg border border-surface-200-800 bg-panel p-5"
      >
        <h2 id="report-what" class="text-lg font-semibold">{m.admin_report_what()}</h2>
        <dl class="mt-4 divide-y divide-surface-200-800 border-y border-surface-200-800">
          <div class={row}>
            <dt class="text-sm font-semibold text-muted">{m.report_reason()}</dt>
            <dd>{reasonLabel(report.report.reason, kind)}</dd>
          </div>
          <div class={row}>
            <dt class="text-sm font-semibold text-muted">{m.admin_report_details()}</dt>
            <!-- Text the reporter typed: shown as text, never as markup. -->
            <dd class="wrap-break-word whitespace-pre-line">
              {report.report.details || m.admin_report_no_details()}
            </dd>
          </div>
          <div class={row}>
            <dt class="text-sm font-semibold text-muted">{m.admin_report_reporter()}</dt>
            <dd>
              <UserLink
                username={report.reporter.username}
                label={handle(report.reporter.username)}
                class="font-semibold"
              />
              <a
                class="ml-2 anchor text-sm"
                href={localizedHref(`/admin/users/${report.reporter.id}`, locale)}
                >{m.admin_user_title()}</a
              >
            </dd>
          </div>
          {#if report.report.resolvedAt}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_closed()}</dt>
              <dd>
                {when(report.report.resolvedAt)}
                {#if report.report.resolutionNote}
                  <p class="mt-1 wrap-break-word whitespace-pre-line text-muted">
                    {report.report.resolutionNote}
                  </p>
                {/if}
              </dd>
            </div>
          {/if}
        </dl>
      </section>

      <section
        aria-labelledby="report-context"
        class="rounded-lg border border-surface-200-800 bg-panel p-5"
      >
        <h2 id="report-context" class="text-lg font-semibold">{m.admin_report_context()}</h2>
        <dl class="mt-4 divide-y divide-surface-200-800 border-y border-surface-200-800">
          {#if report.player}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_profile()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <UserLink
                  username={report.player.username}
                  label={handle(report.player.username)}
                  class="font-semibold"
                />
                <a
                  class="ml-2 anchor text-sm"
                  href={localizedHref(`/admin/users/${report.player.id}`, locale)}
                  >{m.admin_user_title()}</a
                >
                {#if report.player.status === 'suspended'}
                  <StatusBadge status="user:banned" />
                {/if}
              </dd>
            </div>
          {/if}
          {#if partner}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_partner()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{partner.name}</span>
                {#if partner.removedAt}
                  <span class="text-sm text-muted">{m.admin_partners_removed()}</span>
                {:else if !partner.approvedAt}
                  <span class="text-sm text-muted">{m.partner_status_pending()}</span>
                {/if}
              </dd>
            </div>
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_partners_col_links()}</dt>
              <dd>
                <ul class="flex flex-wrap gap-3">
                  {#each [...(partner.siteUrl ? [{ network: 'website' as const, url: partner.siteUrl }] : []), ...partner.links] as link (link.network + link.url)}
                    <li>
                      <!-- eslint-disable svelte/no-navigation-without-resolve -- the partner's own link on another site, not an app route -->
                      <a
                        class="inline-flex items-center gap-1 anchor"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        ><Icon
                          name={networkIcons[link.network as keyof typeof networkIcons]}
                          size={18}
                        />{networkLabels[link.network as keyof typeof networkLabels]()}<span
                          class="sr-only"
                        >
                          {m.partner_opens_new_tab()}</span
                        ></a
                      >
                      <!-- eslint-enable svelte/no-navigation-without-resolve -->
                    </li>
                  {/each}
                </ul>
              </dd>
            </div>
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_partners_col_backlink()}</dt>
              <dd>
                {#if partner.backlinkUrl}
                  <!-- eslint-disable svelte/no-navigation-without-resolve -- where the partner put our link, on another site -->
                  <a
                    class="anchor"
                    href={partner.backlinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    >{m.admin_partners_check()}<span class="sr-only">
                      {m.partner_opens_new_tab()}</span
                    ></a
                  >
                  <!-- eslint-enable svelte/no-navigation-without-resolve -->
                {:else}
                  <span class="text-warning-700-300">{m.admin_partners_not_informed()}</span>
                {/if}
              </dd>
            </div>
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.partner_sent_by_label()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                {#if partner.submitter}
                  <UserLink
                    username={partner.submitter.username}
                    label={handle(partner.submitter.username)}
                    class="font-semibold"
                  />
                  <a
                    class="ml-2 anchor text-sm"
                    href={localizedHref(`/admin/users/${partner.submitter.id}`, locale)}
                    >{m.admin_user_title()}</a
                  >
                {/if}
              </dd>
            </div>
          {/if}
          {#if campaign}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_crowdfunding()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <!-- The link a member shared: it leaves the site, so it opens apart and says so. -->
                <a
                  class="anchor font-semibold"
                  href={campaign.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  >{campaign.name}<span class="sr-only">
                    {m.crowdfunding_opens_new_tab({
                      site: siteName(campaign.platform, campaign.url),
                    })}</span
                  ></a
                >
                {#if campaign.removedAt}
                  <span class="text-sm text-muted">{m.admin_crowdfunding_removed()}</span>
                {/if}
              </dd>
            </div>
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.crowdfunding_owner_label()}</dt>
              <dd>{campaign.owner}</dd>
            </div>
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.crowdfunding_sent_by_label()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                {#if campaign.submitter}
                  <UserLink
                    username={campaign.submitter.username}
                    label={handle(campaign.submitter.username)}
                    class="font-semibold"
                  />
                  <a
                    class="ml-2 anchor text-sm"
                    href={localizedHref(`/admin/users/${campaign.submitter.id}`, locale)}
                    >{m.admin_user_title()}</a
                  >
                {:else}
                  {submissionLabel(null, campaign.importSource)}
                {/if}
              </dd>
            </div>
          {/if}
          {#if report.table}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">
                {isTable ? m.admin_report_table() : m.admin_report_where()}
              </dt>
              <dd class="flex flex-wrap items-center gap-2">
                {#if report.table.status === 'disabled'}
                  <span class="font-semibold">{report.table.title}</span>
                {:else}
                  <a
                    class="anchor font-semibold"
                    href={localizedHref(`/tables/${report.table.slug}`, locale)}
                    >{report.table.title}</a
                  >
                {/if}
                <StatusBadge status={`table:${report.table.status}` as Status} />
              </dd>
            </div>
          {/if}
          {#if report.gm}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_gm()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <UserLink
                  username={report.gm.username}
                  label={handle(report.gm.username)}
                  class="font-semibold"
                />
                <a
                  class="ml-2 anchor text-sm"
                  href={localizedHref(`/admin/users/${report.gm.id}`, locale)}
                  >{m.admin_user_title()}</a
                >
                {#if report.gm.status === 'suspended'}
                  <StatusBadge status="user:banned" />
                {/if}
              </dd>
            </div>
          {/if}
        </dl>
        {#if isTable}
          <p class="mt-4 text-sm text-muted">{m.admin_report_table_ban_hint()}</p>
        {/if}
      </section>
    </div>

    <aside
      aria-labelledby="report-actions"
      class="grid h-fit content-start gap-3 rounded-lg border border-surface-200-800 bg-panel p-5 xl:sticky xl:top-6"
    >
      <h2 id="report-actions" class="text-lg font-semibold">{m.admin_report_decision()}</h2>
      {#if !report.can.close}
        <p class="text-muted">{m.admin_report_nothing_left()}</p>
      {/if}
      {#if report.can.removeCrowdfunding && campaign}
        <ModerationDialog
          action="?/removeCrowdfunding"
          schema={removeCrowdfundingSchema}
          fields={{ id: campaign.id, reportId: report.report.id }}
          danger
          reasons={CROWDFUNDING_REPORT_REASONS}
          write={{
            name: 'note',
            label: m.admin_crowdfunding_remove_note(),
            hint: m.admin_crowdfunding_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
          }}
          label={m.admin_crowdfunding_remove()}
          title={m.admin_crowdfunding_remove_title({ name: campaign.name })}
          text={m.admin_crowdfunding_remove_text()}
          confirm={m.admin_crowdfunding_remove_confirm()}
          success={m.admin_crowdfunding_remove_done()}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.removePartner && partner}
        <ModerationDialog
          action="?/removePartner"
          schema={removePartnerSchema}
          fields={{ id: partner.id, reportId: report.report.id }}
          danger
          reasons={PARTNER_REPORT_REASONS}
          reasonTarget="partner"
          write={{
            name: 'note',
            label: m.admin_partners_remove_note(),
            hint: m.admin_partners_remove_note_hint({ max: RESOLUTION_NOTE_MAX }),
          }}
          label={m.admin_partners_remove()}
          title={m.admin_partners_remove_title({ name: partner.name })}
          text={m.admin_partners_remove_text()}
          confirm={m.admin_partners_remove_confirm()}
          success={m.admin_partners_remove_done()}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.closeTable}
        <ModerationDialog
          action="?/closeTable"
          schema={closeTableSchema}
          {fields}
          danger
          write={{
            name: 'note',
            label: m.moderation_close_table_note(),
            hint: m.moderation_close_table_hint({ max: RESOLUTION_NOTE_MAX }),
            required: true,
          }}
          label={m.admin_report_close_table()}
          title={m.admin_report_close_table_title({ table: report.table?.title ?? '' })}
          text={m.admin_report_close_table_text()}
          confirm={m.admin_report_close_table()}
          success={m.admin_report_close_table_done()}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.ban && report.player}
        <ModerationDialog
          action="?/ban"
          schema={banFromReportSchema}
          {fields}
          danger
          durations
          write={{
            name: 'reason',
            label: m.moderation_ban_reason(),
            hint: m.moderation_ban_reason_hint({ max: RESOLUTION_NOTE_MAX }),
            required: true,
          }}
          label={m.admin_ban()}
          title={m.admin_ban_title({ user: handle(report.player.username) })}
          username={report.player.username}
          text={m.admin_ban_text()}
          confirm={m.admin_ban()}
          success={m.admin_ban_done()}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.review}
        <ModerationDialog
          action="?/review"
          schema={reportIdSchema}
          {fields}
          label={m.admin_report_review()}
          title={m.admin_report_review()}
          text={m.admin_report_review_text()}
          confirm={m.admin_report_review()}
          success={m.admin_report_review_done()}
          triggerClass={ghost}
        />
      {/if}
      {#if report.can.close}
        <ModerationDialog
          action="?/accept"
          schema={closeReportSchema}
          {fields}
          write={note}
          label={m.admin_report_accept()}
          title={m.admin_report_accept()}
          text={m.admin_report_accept_text()}
          confirm={m.admin_report_accept()}
          success={m.admin_report_accept_done()}
          triggerClass={isTable || !report.can.ban ? primary : ghost}
        />
        <ModerationDialog
          action="?/dismiss"
          schema={closeReportSchema}
          {fields}
          write={note}
          label={m.admin_report_dismiss()}
          title={m.admin_report_dismiss()}
          text={m.admin_report_dismiss_text()}
          confirm={m.admin_report_dismiss()}
          success={m.admin_report_dismiss_done()}
          triggerClass={ghost}
        />
      {/if}
    </aside>
  </div>
</AdminPage>
