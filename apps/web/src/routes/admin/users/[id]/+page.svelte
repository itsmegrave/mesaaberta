<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import AuditTimeline from '../../components/ui/AuditTimeline.svelte';
  import DetailList from '#lib/components/ui/DetailList.svelte';
  import DetailRow from '#lib/components/ui/DetailRow.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import Panel from '#lib/components/ui/Panel.svelte';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import StatusBadge from '#lib/components/ui/StatusBadge.svelte';
  import ModerationDialog from '#lib/components/admin/ModerationDialog.svelte';
  import {
    accountSchema,
    banSchema,
    TABLE_REPORTS_WARNING,
  } from '@mesaaberta/core/moderation/reports';
  import { ban as banWords, banReason } from '#lib/admin/moderation-presets.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { m } from '#lib/paraglide/messages.js';

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

  function copyId() {
    return copyText(data.user.id, m.toast_id_copied());
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
        href: `/u/${encodeURIComponent(data.user.username)}`,
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
</script>

<AdminPage
  title={handle}
  tabTitle={`${data.user.username ?? m.admin_user_title()} | Mesa Aberta`}
  eyebrow={m.admin_user_title()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_profile_list(), href: data.back },
    { label: m.admin_user_title() },
  ]}
  {menu}
>
  {#snippet lead()}
    <MAAvatar
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
      buttonClass="btn h-11 gap-2 rounded-lg btn-secondary px-4 font-semibold"
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
        write={banReason()}
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
        {...banWords(handle)}
        choices={['permanent']}
        label={m.admin_menu_ban()}
        username={data.user.username}
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
    <Panel title={m.admin_user_data()}>
      <DetailList class="mt-3">
        {#each details as [label, value] (label)}
          <DetailRow {label} class="text-sm break-all">
            {#if label === m.admin_profile_username()}<UserLink
                username={data.user.username}
                label={value}
              />{:else}{value}{/if}
          </DetailRow>
        {/each}
        <DetailRow label={m.admin_profile_id()} class="font-mono text-xs break-all"
          >{data.user.id}</DetailRow
        >
      </DetailList>
    </Panel>

    <Panel>
      <MAAccordion collapse="phone" value={reported >= TABLE_REPORTS_WARNING ? ['activity'] : []}>
        <MAAccordionItem
          value="activity"
          title={m.admin_user_activity()}
          summary={m.admin_user_activity_summary({
            playing: activity.playing,
            running: activity.running,
            reports: reported,
          })}
        >
          <DetailList>
            <DetailRow label={m.admin_user_playing()} class="text-sm tabular-nums"
              >{activity.playing}</DetailRow
            >
            <DetailRow label={m.admin_user_running()} class="text-sm tabular-nums"
              >{activity.running}</DetailRow
            >
            <DetailRow label={m.admin_user_rating()} class="text-sm"
              ><GmRating rating={activity.rating} /></DetailRow
            >
            <DetailRow label={m.admin_user_reports()} class="text-sm tabular-nums"
              >{reported}</DetailRow
            >
          </DetailList>
          {#if reported >= TABLE_REPORTS_WARNING && !ban}
            <p role="note" class="mt-3 flex items-start gap-2 text-sm font-semibold">
              <Icon name="triangle-alert" size={18} class="mt-0.5 text-lamp" />
              {m.admin_table_reports_warning()}
            </p>
          {/if}
        </MAAccordionItem>
      </MAAccordion>
    </Panel>
  </div>

  <Panel title={m.history_title()} class="mt-6 p-5">
    <AuditTimeline history={data.history} zone={data.viewer.timezone} showTable />
  </Panel>
</AdminPage>
