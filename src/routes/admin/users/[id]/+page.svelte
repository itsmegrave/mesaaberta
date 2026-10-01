<script lang="ts">
  import Avatar from '$lib/components/Avatar.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import {
    accountSchema,
    banSchema,
    RESOLUTION_NOTE_MAX,
    TABLE_REPORTS_WARNING,
  } from '$lib/moderation/reports';
  import { atHandle } from '$lib/profile/handle';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
  const locale = getLocale();
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: data.viewer.timezone,
    }).format(value);
  const details = $derived([
    [m.admin_profile_username(), data.user.username ?? m.admin_profile_no_username()],
    [m.admin_user_name(), data.user.name ?? m.admin_user_unset()],
    [m.admin_user_city(), data.user.city ?? m.admin_user_unset()],
    [m.admin_user_timezone(), data.user.timezone ?? m.admin_user_unset()],
    [m.admin_user_created(), date(data.user.createdAt)],
    [m.admin_user_updated(), date(data.user.updatedAt)],
  ]);
  const handle = $derived(
    data.user.username ? atHandle(data.user.username) : m.admin_profile_no_username(),
  );
  const ban = $derived(data.moderation.ban);
  const reported = $derived(data.moderation.acceptedTableReports);
</script>

<svelte:head><title>{data.user.username ?? m.admin_user_title()} | Mesa Aberta</title></svelte:head>
<section class="py-6 md:py-10">
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_user_title() }]}
    class="mb-6"
  />
  <a class="inline-flex min-h-11 items-center gap-2 anchor" href={localizedHref(data.back, locale)}
    ><Icon name="chevron-left" />{m.admin_user_back()}</a
  >
  <header class="mt-6 flex flex-wrap items-start justify-between gap-6">
    <div class="flex min-w-0 items-center gap-5">
      <Avatar
        src={data.avatar}
        name={data.user.name ?? data.user.username ?? m.admin_user_title()}
        size={72}
      />
      <div class="min-w-0">
        <p class="font-semibold text-muted">{m.admin_user_title()}</p>
        <h1 class="mt-1 text-3xl leading-tight font-semibold wrap-break-word md:text-5xl">
          {handle}
        </h1>
        <p class="mt-2 flex flex-wrap items-center gap-3">
          <span
            class="chip h-6 rounded-full border px-3 text-xs font-semibold {ban
              ? 'border-error-500 text-error-700-300'
              : 'border-surface-200-800'}"
            >{ban ? m.admin_profile_banned() : m.admin_profile_active()}</span
          >
          <span class="font-mono text-xs break-all text-muted"
            >{m.admin_profile_id()}: {data.user.id}</span
          >
        </p>
      </div>
    </div>
    {#if data.moderation.canModerate}
      {#if ban}
        <ModerationDialog
          action="?/revoke"
          schema={accountSchema}
          fields={{ profileId: data.user.id }}
          label={m.admin_revoke()}
          title={m.admin_revoke_title({ user: handle })}
          text={m.admin_revoke_text()}
          confirm={m.admin_revoke()}
          success={m.admin_revoke_done()}
          triggerClass="btn h-12 rounded-lg border-2 border-surface-200-800 px-5 font-semibold hover:preset-tonal"
        />
      {:else}
        <ModerationDialog
          action="?/ban"
          schema={banSchema}
          fields={{ profileId: data.user.id }}
          danger
          durations
          write={{
            name: 'reason',
            label: m.moderation_ban_reason(),
            hint: m.moderation_ban_reason_hint({ max: RESOLUTION_NOTE_MAX }),
            required: true,
          }}
          label={m.admin_ban()}
          title={m.admin_ban_title({ user: handle })}
          text={m.admin_ban_text()}
          confirm={m.admin_ban()}
          success={m.admin_ban_done()}
          triggerClass="btn h-12 rounded-lg border-2 border-surface-200-800 px-5 font-semibold text-error-700-300 hover:preset-tonal-error"
        />
      {/if}
    {/if}
  </header>

  {#if ban}
    <section
      aria-labelledby="ban-title"
      class="mt-8 max-w-2xl rounded-lg border border-error-500 bg-panel p-6"
    >
      <h2 id="ban-title" class="text-xl font-semibold">
        {ban.until ? m.admin_ban_until({ date: date(ban.until) }) : m.admin_ban_forever()}
      </h2>
      <p class="mt-1 text-sm text-muted">{m.admin_ban_since({ date: date(ban.at) })}</p>
      <p class="mt-3 wrap-break-word whitespace-pre-line">{ban.reason}</p>
    </section>
  {/if}

  <section
    aria-labelledby="table-reports"
    class="mt-8 max-w-2xl rounded-lg border p-6 {reported >= TABLE_REPORTS_WARNING && !ban
      ? 'border-warning-500 bg-warning-500/10'
      : 'border-surface-200-800 bg-panel'}"
  >
    <h2 id="table-reports" class="text-xl font-semibold">{m.admin_table_reports_title()}</h2>
    <p class="mt-2">{m.admin_table_reports_count({ count: reported })}</p>
    {#if reported >= TABLE_REPORTS_WARNING && !ban}
      <p role="note" class="mt-2 font-semibold">{m.admin_table_reports_warning()}</p>
    {/if}
  </section>

  <dl
    class="mt-8 max-w-2xl divide-y divide-surface-200-800 rounded-lg border border-surface-200-800 bg-panel px-6"
  >
    {#each details as [label, value] (label)}
      <div class="grid gap-2 py-4 sm:grid-cols-2">
        <dt class="text-sm font-semibold text-muted">{label}</dt>
        <dd class="text-sm break-all">{value}</dd>
      </div>
    {/each}
  </dl>
</section>
