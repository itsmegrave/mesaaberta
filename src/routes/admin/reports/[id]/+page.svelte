<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { reasonLabel, reportStatusLabel } from '$lib/moderation/labels';
  import {
    banFromReportSchema,
    closeReportSchema,
    closeTableSchema,
    reportIdSchema,
    RESOLUTION_NOTE_MAX,
  } from '$lib/moderation/reports';
  import { atHandle } from '$lib/profile/handle';
  import { tableStatusLabel } from '$lib/tables/status';
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
  const isTable = $derived(report.report.targetType === 'table');
  const target = $derived(
    isTable
      ? m.admin_reports_target_table({ table: report.table.title })
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
  const chip =
    'chip h-6 rounded-full border border-surface-200-800 px-3 text-xs font-semibold whitespace-nowrap';
  const row = 'grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4';
</script>

<svelte:head><title>{m.admin_report_title()} | Mesa Aberta</title></svelte:head>

<section class="py-6 md:py-10">
  <Breadcrumbs
    items={[
      { label: m.nav_admin(), href: '/admin' },
      { label: m.admin_reports_title(), href: '/admin/reports' },
      { label: m.admin_report_title() },
    ]}
    class="mb-6"
  />

  <header class="min-w-0">
    <p class="font-semibold text-muted">
      {isTable ? m.admin_report_kind_table() : m.admin_report_kind_player()}
    </p>
    <h1 class="mt-1 text-3xl leading-tight font-semibold wrap-break-word md:text-5xl">
      {target}
    </h1>
    <p class="mt-3 flex flex-wrap items-center gap-3">
      <span class={chip}>{reportStatusLabel(report.report.status)}</span>
      <span class="text-sm text-muted">
        {reasonLabel(report.report.reason)} · {when(report.report.createdAt)}
      </span>
    </p>
  </header>

  <div class="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] lg:gap-12">
    <div class="grid content-start gap-8">
      <section
        aria-labelledby="report-what"
        class="rounded-lg border border-surface-200-800 bg-panel p-6"
      >
        <h2 id="report-what" class="text-xl font-semibold">{m.admin_report_what()}</h2>
        <dl class="mt-4 divide-y divide-surface-200-800 border-y border-surface-200-800">
          <div class={row}>
            <dt class="text-sm font-semibold text-muted">{m.report_reason()}</dt>
            <dd>{reasonLabel(report.report.reason)}</dd>
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
              <a
                class="anchor font-semibold"
                href={localizedHref(`/admin/users/${report.reporter.id}`, locale)}
                >{handle(report.reporter.username)}</a
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
        class="rounded-lg border border-surface-200-800 bg-panel p-6"
      >
        <h2 id="report-context" class="text-xl font-semibold">{m.admin_report_context()}</h2>
        <dl class="mt-4 divide-y divide-surface-200-800 border-y border-surface-200-800">
          {#if report.player}
            <div class={row}>
              <dt class="text-sm font-semibold text-muted">{m.admin_report_profile()}</dt>
              <dd class="flex flex-wrap items-center gap-2">
                <a
                  class="anchor font-semibold"
                  href={localizedHref(`/admin/users/${report.player.id}`, locale)}
                  >{handle(report.player.username)}</a
                >
                {#if report.player.status === 'suspended'}
                  <span class={chip}>{m.admin_profile_banned()}</span>
                {/if}
              </dd>
            </div>
          {/if}
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
              <span class={chip}>
                {tableStatusLabel(report.table.status) ?? m.admin_report_table_open()}
              </span>
            </dd>
          </div>
          <div class={row}>
            <dt class="text-sm font-semibold text-muted">{m.admin_report_gm()}</dt>
            <dd class="flex flex-wrap items-center gap-2">
              <a
                class="anchor font-semibold"
                href={localizedHref(`/admin/users/${report.gm.id}`, locale)}
                >{handle(report.gm.username)}</a
              >
              {#if report.gm.status === 'suspended'}
                <span class={chip}>{m.admin_profile_banned()}</span>
              {/if}
            </dd>
          </div>
        </dl>
        {#if isTable}
          <p class="mt-4 text-sm text-muted">{m.admin_report_table_ban_hint()}</p>
        {/if}
      </section>
    </div>

    <aside aria-labelledby="report-actions" class="grid content-start gap-3">
      <h2 id="report-actions" class="text-xl font-semibold">{m.admin_report_actions()}</h2>
      {#if !report.can.close}
        <p class="text-muted">{m.admin_report_nothing_left()}</p>
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
          title={m.admin_report_close_table_title({ table: report.table.title })}
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
          label={m.admin_ban_named({ user: handle(report.player.username) })}
          title={m.admin_ban_title({ user: handle(report.player.username) })}
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
</section>
