<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import AdminPersonLink from '#lib/components/admin/ui/AdminPersonLink.svelte';
  import DetailList from '#lib/components/ui/DetailList.svelte';
  import DetailRow from '#lib/components/ui/DetailRow.svelte';
  import Panel from '#lib/components/ui/Panel.svelte';
  import StatusBadge, { type Status } from '#lib/components/ui/StatusBadge.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import { periodLabel } from '#lib/crowdfunding/format.js';
  import { platformLabel, siteName, submissionLabel } from '#lib/crowdfunding/labels.js';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { reasonLabel } from '#lib/moderation/labels.js';
  import {
    banFromReportSchema,
    closeReportSchema,
    closeTableSchema,
    removeCrowdfundingSchema,
    removePartnerSchema,
    reportIdSchema,
    RESOLUTION_NOTE_MAX,
  } from '@mesaaberta/core/moderation/reports';
  import {
    ban,
    closeTable,
    removeCrowdfunding,
    removePartner,
  } from '#lib/admin/moderation-presets.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { networkIcons, networkLabels } from '#lib/profile/social-presentation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

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

  const ghost = 'btn h-12 w-full rounded-lg btn-secondary px-4 font-semibold';
  const primary = 'btn h-12 w-full rounded-lg preset-filled-primary-500 px-4 font-semibold';
  const danger =
    'btn h-12 w-full rounded-lg border-2 border-surface-200-800 px-4 font-semibold text-error-700-300 hover:preset-tonal-error';
</script>

<AdminPage
  title={target}
  tabTitle={`${m.admin_report_title()} | Mesa Aberta`}
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
      <Panel title={m.admin_report_what()}>
        <DetailList layout="label" class="mt-4 border-y border-surface-200-800">
          <DetailRow label={m.report_reason()}>{reasonLabel(report.report.reason, kind)}</DetailRow>
          <!-- Text the reporter typed: shown as text, never as markup. -->
          <DetailRow label={m.admin_report_details()} class="wrap-break-word whitespace-pre-line">
            {report.report.details || m.admin_report_no_details()}
          </DetailRow>
          <DetailRow label={m.admin_report_reporter()}>
            <AdminPersonLink person={report.reporter} />
          </DetailRow>
          {#if report.report.resolvedAt}
            <DetailRow label={m.admin_report_closed()}>
              {when(report.report.resolvedAt)}
              {#if report.report.resolutionNote}
                <p class="mt-1 wrap-break-word whitespace-pre-line text-muted">
                  {report.report.resolutionNote}
                </p>
              {/if}
            </DetailRow>
          {/if}
        </DetailList>
      </Panel>

      <Panel title={m.admin_report_context()}>
        <DetailList layout="label" class="mt-4 border-y border-surface-200-800">
          {#if report.player}
            <DetailRow label={m.admin_report_profile()} class="flex flex-wrap items-center gap-2">
              <AdminPersonLink person={report.player} />
            </DetailRow>
          {/if}
          {#if partner}
            <DetailRow label={m.admin_report_partner()} class="flex flex-wrap items-center gap-2">
              <span class="font-semibold">{partner.name}</span>
              {#if partner.removedAt}
                <span class="text-sm text-muted">{m.admin_partners_removed()}</span>
              {:else if !partner.approvedAt}
                <span class="text-sm text-muted">{m.partner_status_pending()}</span>
              {/if}
            </DetailRow>
            <DetailRow label={m.admin_partners_col_links()}>
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
            </DetailRow>
            <DetailRow label={m.admin_partners_col_backlink()}>
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
            </DetailRow>
            <DetailRow label={m.partner_sent_by_label()} class="flex flex-wrap items-center gap-2">
              {#if partner.submitter}
                <AdminPersonLink person={partner.submitter} />
              {/if}
            </DetailRow>
            {#if partner.contactEmail}
              <DetailRow label={m.admin_partners_contact_email()}>
                <!-- eslint-disable svelte/no-navigation-without-resolve -- a mail address, not a page -->
                <a
                  class="inline-flex items-center gap-1.5 anchor"
                  href="mailto:{partner.contactEmail}"
                  ><Icon name="mail" size={18} class="shrink-0" />{partner.contactEmail}</a
                >
                <!-- eslint-enable svelte/no-navigation-without-resolve -->
              </DetailRow>
            {/if}
          {/if}
          {#if campaign}
            <DetailRow
              label={m.admin_report_crowdfunding()}
              class="flex flex-wrap items-center gap-2"
            >
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
            </DetailRow>
            <DetailRow label={m.crowdfunding_owner_label()}>{campaign.owner}</DetailRow>
            <DetailRow label={m.admin_report_platform()}
              >{platformLabel(campaign.platform)}</DetailRow
            >
            <DetailRow label={m.admin_report_period()}
              >{periodLabel(campaign.startsOn, campaign.endsOn, locale)}</DetailRow
            >
            <DetailRow
              label={m.crowdfunding_sent_by_label()}
              class="flex flex-wrap items-center gap-2"
            >
              {#if campaign.submitter}
                <AdminPersonLink person={campaign.submitter} />
              {:else}
                <span class="inline-flex items-center gap-1.5">
                  <Icon name="import" size={18} class="shrink-0 text-muted" />
                  {submissionLabel(null, campaign.importSource)}
                </span>
              {/if}
            </DetailRow>
          {/if}
          {#if report.table}
            <DetailRow
              label={isTable ? m.admin_report_table() : m.admin_report_where()}
              class="flex flex-wrap items-center gap-2"
            >
              {#if report.table.status === 'disabled'}
                <span class="font-semibold">{report.table.title}</span>
              {:else}
                <a class="anchor font-semibold" href={`/t/${report.table.slug}`}
                  >{report.table.title}</a
                >
              {/if}
              <StatusBadge status={`table:${report.table.status}` as Status} />
            </DetailRow>
          {/if}
          {#if report.gm}
            <DetailRow label={m.admin_report_gm()} class="flex flex-wrap items-center gap-2">
              <AdminPersonLink person={report.gm} />
            </DetailRow>
          {/if}
        </DetailList>
        {#if isTable}
          <p class="mt-4 text-sm text-muted">{m.admin_report_table_ban_hint()}</p>
        {/if}
      </Panel>
    </div>

    <Panel
      as="aside"
      title={m.admin_report_decision()}
      class="grid h-fit content-start gap-3 p-5 xl:sticky xl:top-6"
    >
      <p class="text-sm text-muted">{m.admin_report_decision_note()}</p>
      {#if !report.can.close}
        <p class="text-muted">{m.admin_report_nothing_left()}</p>
      {/if}
      {#if report.can.removeCrowdfunding && campaign}
        <ModerationDialog
          action="?/removeCrowdfunding"
          schema={removeCrowdfundingSchema}
          fields={{ id: campaign.id, reportId: report.report.id }}
          {...removeCrowdfunding(campaign.name)}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.removePartner && partner}
        <ModerationDialog
          action="?/removePartner"
          schema={removePartnerSchema}
          fields={{ id: partner.id, reportId: report.report.id }}
          {...removePartner(partner.name)}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.closeTable}
        <ModerationDialog
          action="?/closeTable"
          schema={closeTableSchema}
          {fields}
          {...closeTable(report.table?.title ?? '')}
          label={m.admin_report_close_table()}
          text={m.admin_report_close_table_text()}
          success={m.admin_report_close_table_done()}
          triggerClass={danger}
        />
      {/if}
      {#if report.can.ban && report.player}
        <ModerationDialog
          action="?/ban"
          schema={banFromReportSchema}
          {fields}
          {...ban(handle(report.player.username))}
          label={m.admin_ban()}
          username={report.player.username}
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
    </Panel>
  </div>
</AdminPage>
