<script lang="ts">
  import GmRating from '$lib/components/GmRating.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import ActionForm from '$lib/components/ActionForm.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { type KebabItem } from '$lib/components/KebabMenu.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import ModerationDialog from '$lib/components/admin/ModerationDialog.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import {
    accountSchema,
    banSchema,
    RESOLUTION_NOTE_MAX,
    TABLE_REPORTS_WARNING,
  } from '$lib/moderation/reports';
  import { atHandle } from '$lib/profile/handle';
  import { toast } from '$lib/toaster';
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
  const activity = $derived(data.activity);

  // One line on what the status means for the person.
  const meaning = $derived.by(() => {
    if (data.standing === 'active') return m.admin_user_meaning_active();
    if (data.standing === 'banned') return m.admin_user_meaning_banned();
    return ban?.until
      ? m.admin_user_meaning_suspended({ date: date(ban.until) })
      : m.admin_user_meaning_closed();
  });

  async function copyId() {
    try {
      await navigator.clipboard.writeText(data.user.id);
      toast.success(m.toast_id_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }
  // The title's "3 dots": the user's public page, their ID, and the decisions (each asks first).
  let suspending = $state(false);
  let banning = $state(false);
  let revoking = $state(false);
  const menu = $derived.by(() => {
    const items: KebabItem[] = [];
    if (data.user.username) {
      items.push({
        id: 'public',
        label: m.admin_menu_public_profile(),
        icon: 'game-icons:meeple',
        href: localizedHref(`/u/${encodeURIComponent(data.user.username)}`, locale),
      });
    }
    items.push({ id: 'copy', label: m.admin_menu_copy_id(), icon: 'copy', onselect: copyId });
    if (data.moderation.canModerate) {
      if (ban) {
        items.push({
          id: 'revoke',
          label: m.admin_menu_revoke(),
          icon: 'lock',
          destructive: true,
          onselect: () => (revoking = true),
        });
      } else {
        items.push(
          {
            id: 'suspend',
            label: m.admin_menu_suspend(),
            icon: 'clock',
            destructive: true,
            onselect: () => (suspending = true),
          },
          {
            id: 'ban',
            label: m.admin_menu_ban(),
            icon: 'lock',
            destructive: true,
            onselect: () => (banning = true),
          },
        );
      }
    }
    return items;
  });
  const banWrite = {
    name: 'reason',
    label: m.moderation_ban_reason(),
    hint: m.moderation_ban_reason_hint({ max: RESOLUTION_NOTE_MAX }),
    required: true,
  } as const;
  const card = 'rounded-lg border border-surface-200-800 bg-panel p-5';
</script>

<svelte:head><title>{data.user.username ?? m.admin_user_title()} | Mesa Aberta</title></svelte:head>
<AdminPage
  title={handle}
  eyebrow={m.admin_user_title()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_profile_list(), href: data.back },
    { label: m.admin_user_title() },
  ]}
  {menu}
>
  {#snippet lead()}
    <Avatar
      src={data.avatar}
      name={data.user.name ?? data.user.username ?? m.admin_user_title()}
      size={72}
    />
  {/snippet}
  {#snippet status()}
    <p class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <StatusBadge status={`user:${data.standing}`} />
      <span class="text-sm text-muted">{meaning}</span>
    </p>
  {/snippet}
  {#snippet actions()}
    <ActionForm
      action="?/message"
      label={m.admin_user_message()}
      icon="game-icons:scroll-quill"
      buttonClass="btn h-11 gap-2 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
    />
  {/snippet}

  {#if data.moderation.canModerate}
    {#if ban}
      <ModerationDialog
        bind:open={revoking}
        trigger={false}
        action="?/revoke"
        schema={accountSchema}
        fields={{ profileId: data.user.id }}
        label={m.admin_revoke()}
        title={m.admin_revoke_title({ user: handle })}
        username={data.user.username}
        text={m.admin_revoke_text()}
        confirm={m.admin_revoke()}
        success={m.admin_revoke_done()}
      />
    {:else}
      <ModerationDialog
        bind:open={suspending}
        trigger={false}
        action="?/ban"
        schema={banSchema}
        fields={{ profileId: data.user.id }}
        danger
        durations
        choices={['7', '30', '90']}
        write={banWrite}
        label={m.admin_menu_suspend()}
        title={m.admin_suspend_title({ user: handle })}
        username={data.user.username}
        text={m.admin_suspend_text()}
        confirm={m.admin_suspend_confirm()}
        success={m.admin_suspend_done()}
      />
      <ModerationDialog
        bind:open={banning}
        trigger={false}
        action="?/ban"
        schema={banSchema}
        fields={{ profileId: data.user.id }}
        danger
        durations
        choices={['permanent']}
        write={banWrite}
        label={m.admin_menu_ban()}
        title={m.admin_ban_title({ user: handle })}
        username={data.user.username}
        text={m.admin_ban_text()}
        confirm={m.admin_ban()}
        success={m.admin_ban_done()}
      />
    {/if}
  {/if}

  {#if ban}
    <section
      aria-labelledby="ban-title"
      class="mt-8 rounded-lg border border-error-500 bg-panel p-5"
    >
      <h2 id="ban-title" class="text-lg font-semibold">
        {ban.until ? m.admin_ban_until({ date: date(ban.until) }) : m.admin_ban_forever()}
      </h2>
      <p class="mt-1 text-sm text-muted">{m.admin_ban_since({ date: date(ban.at) })}</p>
      <p class="mt-3 wrap-break-word whitespace-pre-line">{ban.reason}</p>
    </section>
  {/if}

  <div class="mt-8 grid gap-6 lg:grid-cols-2">
    <section aria-labelledby="user-data" class={card}>
      <h2 id="user-data" class="text-lg font-semibold">{m.admin_user_data()}</h2>
      <dl class="mt-3 divide-y divide-surface-200-800">
        {#each details as [label, value] (label)}
          <div class="grid gap-1 py-3 sm:grid-cols-2">
            <dt class="text-sm font-semibold text-muted">{label}</dt>
            <dd class="text-sm break-all">
              {#if label === m.admin_profile_username()}<UserLink
                  username={data.user.username}
                  label={value}
                />{:else}{value}{/if}
            </dd>
          </div>
        {/each}
        <div class="grid gap-1 py-3 sm:grid-cols-2">
          <dt class="text-sm font-semibold text-muted">{m.admin_profile_id()}</dt>
          <dd class="font-mono text-xs break-all">{data.user.id}</dd>
        </div>
      </dl>
    </section>

    <section aria-labelledby="user-activity" class={card}>
      <h2 id="user-activity" class="text-lg font-semibold">{m.admin_user_activity()}</h2>
      <dl class="mt-3 divide-y divide-surface-200-800">
        <div class="grid gap-1 py-3 sm:grid-cols-2">
          <dt class="text-sm font-semibold text-muted">{m.admin_user_playing()}</dt>
          <dd class="text-sm tabular-nums">{activity.playing}</dd>
        </div>
        <div class="grid gap-1 py-3 sm:grid-cols-2">
          <dt class="text-sm font-semibold text-muted">{m.admin_user_running()}</dt>
          <dd class="text-sm tabular-nums">{activity.running}</dd>
        </div>
        <div class="grid gap-1 py-3 sm:grid-cols-2">
          <dt class="text-sm font-semibold text-muted">{m.admin_user_rating()}</dt>
          <dd class="text-sm"><GmRating rating={activity.rating} /></dd>
        </div>
        <div class="grid gap-1 py-3 sm:grid-cols-2">
          <dt class="text-sm font-semibold text-muted">{m.admin_user_reports()}</dt>
          <dd class="text-sm tabular-nums">{reported}</dd>
        </div>
      </dl>
      {#if reported >= TABLE_REPORTS_WARNING && !ban}
        <p role="note" class="mt-3 flex items-start gap-2 text-sm font-semibold">
          <Icon name="triangle-alert" size={18} class="mt-0.5 text-warning-700-300" />
          {m.admin_table_reports_warning()}
        </p>
      {/if}
    </section>
  </div>
</AdminPage>
