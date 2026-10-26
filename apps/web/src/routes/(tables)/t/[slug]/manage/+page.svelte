<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  import InvitationAction from '#lib/components/InvitationAction.svelte';
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import UserText from '#lib/components/ui/UserText.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import ConfirmAction from '#lib/components/ConfirmAction.svelte';
  import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import { page } from '$app/state';
  import Chair from '#lib/components/ui/Chair.svelte';
  import SeatDots from '#lib/components/ui/SeatDots.svelte';
  import RosterRow, { rosterRowClass } from './components/ui/RosterRow.svelte';
  import SessionConfirmation from './components/SessionConfirmation.svelte';
  import SessionDate from '../components/ui/SessionDate.svelte';
  import SummaryRow from '../components/ui/SummaryRow.svelte';
  import { Target } from '#lib/target.svelte.js';
  import TableGoingOn from './components/TableGoingOn.svelte';
  import TableHead from '../components/ui/TableHead.svelte';
  import TableTabs from '../components/ui/TableTabs.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import PlayerRatings from './components/PlayerRatings.svelte';
  import ScoreLine from '#lib/components/ui/ScoreLine.svelte';
  import DraftNotice from '../components/DraftNotice.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { formatHours } from '@mesaaberta/core/tables/format';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { kindLabel, scheduleLabel, seatSummary, seatsLeftLabel } from '#lib/tables/format.js';
  import MinPlayersLine from '#lib/components/ui/MinPlayersLine.svelte';

  let { data: serverData, form: result } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  const locale = getLocale();
  const table = $derived(data.table);
  const zone = $derived(shownTimezone(table.timezone));
  const here = $derived(`/t/${table.slug}/manage`);
  const tablePage = $derived(`/t/${table.slug}`);
  const editPage = $derived(`/t/${table.slug}/edit`);
  const taken = $derived(data.players.length);
  const reservations = $derived(
    data.invitations.filter(
      (invitation) => invitation.status === 'pending' && invitation.expiresAt > new Date(),
    ),
  );

  // The "3 dots": beside the title for the table, on each player's row for that player.
  let disableOpen = $state(false);
  const removing = new Target<{ playerId: string; username: string | null }>();
  function copyLink() {
    return copyText(new URL(tablePage, page.url.origin).href, m.toast_link_copied());
  }
  const tableMenu = $derived.by(() => {
    const items: KebabItem[] = [
      ...(data.canEdit
        ? [
            {
              id: 'edit',
              label: table.status === 'draft' ? m.menu_edit_draft() : m.table_edit(),
              icon: 'square-pen' as const,
              href: editPage,
            },
          ]
        : []),
      ...(data.canDuplicate
        ? [
            {
              id: 'duplicate',
              label: m.table_duplicate(),
              icon: 'copy' as const,
              href: `/tables/new?duplicate=${encodeURIComponent(table.slug)}`,
            },
          ]
        : []),
      { id: 'view', label: m.menu_view_table(), icon: 'eye', href: tablePage },
      { id: 'copy', label: m.menu_copy_link(), icon: 'link', onselect: copyLink },
    ];
    if (
      data.canEnd &&
      (table.status === 'active' ||
        table.status === 'draft' ||
        table.status === 'awaiting_confirmation')
    ) {
      items.push({
        id: 'disable',
        label: table.status === 'draft' ? m.menu_delete_draft() : m.menu_close_table(),
        icon: 'trash',
        destructive: true,
        onselect: () => (disableOpen = true),
      });
    }
    return items;
  });
  const playerMenu = (player: { playerId: string; username: string | null }): KebabItem[] => [
    ...(player.username
      ? [
          {
            id: 'profile',
            label: m.menu_view_profile(),
            icon: 'game-icons:meeple' as const,
            href: `/u/${encodeURIComponent(player.username)}`,
          },
        ]
      : []),
    {
      id: 'message',
      label: m.menu_message_player(),
      icon: 'game-icons:scroll-quill',
      onselect: () => document.getElementById(`message-${player.playerId}`)?.click(),
    },
    {
      id: 'remove',
      label: m.menu_remove_player(),
      icon: 'trash',
      destructive: true,
      onselect: () => (removing.current = player),
    },
  ];

  /** "12 de setembro". */
  const day = (date: Date) =>
    new Intl.DateTimeFormat(locale, { timeZone: zone, day: 'numeric', month: 'long' }).format(date);
  /** "27 de setembro, 21:14". */
  const moment = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

  const recurrence = $derived(scheduleLabel(table.kind, table.everyWeeks, table.plannedSessions));
  const seats = $derived(seatsLeftLabel(table.seatsLeft));

  const activityText = (item: (typeof data.activity)[number]) => {
    const player = atHandle(item.player ?? '');
    switch (item.type) {
      case 'TableCreated':
        return m.manage_activity_table_created();
      case 'TableDrafted':
        return m.manage_activity_table_drafted();
      case 'TableUpdated':
        return m.manage_activity_table_updated();
      case 'JoinRequested':
        return m.manage_activity_join_requested({ player });
      case 'JoinApproved':
        return m.manage_activity_join_approved({ player });
      case 'JoinDeclined':
        return m.manage_activity_join_declined({ player });
      case 'PlayerJoined':
        return m.manage_activity_player_joined({ player });
      case 'PlayerLeft':
        return item.removed
          ? m.manage_activity_player_removed({ player })
          : m.manage_activity_player_left({ player });
    }
  };

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-5 md:p-6';
  const secondary = `${buttonClass('secondary')} font-semibold`;
</script>

<svelte:head>
  <title>{m.manage_title({ title: table.title })}</title>
</svelte:head>
<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<article class="pt-2 pb-8 md:pt-6">
  <Breadcrumbs
    items={[
      { label: m.nav_my_tables(), href: '/u/tables' },
      { label: table.title, href: `/t/${table.slug}` },
      { label: m.manage_breadcrumb() },
    ]}
  />

  <TableHead
    title={table.title}
    detail="{table.system.name} · {kindLabel(table.kind)}"
    menu={tableMenu}
  />

  {#if table.status === 'awaiting_confirmation'}
    <SessionConfirmation
      next={here}
      players={data.players}
      multi={table.kind !== 'one_shot'}
      kind={table.kind}
      session={data.session}
      plannedSessions={table.plannedSessions}
      startsAt={table.startsAt}
      step={page.url.searchParams.get('etapa')}
      nextSession={data.nextSession}
      timezone={table.timezone}
      durationHours={table.durationMinutes / 60}
    />
  {/if}
  {#if data.canFinish && table.status === 'active'}
    <TableGoingOn next={here} tableManage={here} players={data.players} />
  {/if}
  {#if table.status === 'draft'}
    <DraftNotice action="?/publish" next={here} waiting={data.systemWaiting} />
  {/if}

  <TableTabs
    slug={table.slug}
    current="players"
    requests={data.requests.length}
    canEdit={data.canEdit}
  />

  <div class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12">
    <div class="grid min-w-0 content-start gap-8 lg:col-span-2">
      <section aria-labelledby="invitations" class={card}>
        <h2 id="invitations" class="text-2xl font-semibold">{m.invitation_manage_title()}</h2>
        <p class="mt-2 text-muted">{m.invitation_manage_help()}</p>
        {#if result && ('error' in result || ('form' in result && 'invitationId' in result.form.data && !result.form.valid))}<p
            role="alert"
            class="mt-3 text-error-alert"
          >
            {m.invitation_unavailable()}
          </p>{/if}
        <p class="mt-3 font-semibold">
          {seatSummary(taken, table.reserved, table.seatsLeft)}
        </p>
        {#if data.canInvite && table.status === 'active' && table.startsAt > new Date()}
          <div class="mt-4 max-w-md">
            <InvitationAction action="?/invite" username label={m.invitation_send()} />
          </div>
        {/if}
        {#if reservations.length > 0}
          <ul class="mt-4 divide-y divide-surface-200-800">
            {#each reservations as invitation (invitation.id)}
              <li class="flex flex-wrap items-center justify-between gap-3 py-3">
                <span
                  ><UserLink username={invitation.username} /><span class="block text-sm text-muted"
                    >{m.invitation_deadline({ date: moment(invitation.expiresAt) })}</span
                  ></span
                >
                <InvitationAction
                  action="?/cancelInvitation"
                  invitationId={invitation.id}
                  label={m.invitation_cancel()}
                />
              </li>
            {/each}
          </ul>
        {/if}
      </section>
      <section aria-labelledby="requests" class={card}>
        <div class="flex items-center gap-3">
          <h2 id="requests" class="text-2xl font-semibold">{m.table_requests()}</h2>
          {#if data.requests.length > 0}
            <span
              class="chip h-6 min-w-6 rounded-full preset-filled-primary-500 px-2 text-xs font-bold"
              >{data.requests.length}</span
            >
          {/if}
        </div>
        {#if table.joinMode === 'auto'}
          <p class="mt-2 text-muted">{m.manage_requests_auto()}</p>
        {:else}
          <p class="mt-2 text-muted">{m.manage_requests_hint()}</p>
        {/if}
        {#if data.requests.length > 0}
          <ul class="mt-3">
            {#each data.requests as request (request.playerId)}
              <RosterRow
                username={request.username}
                avatarUrl={request.avatarUrl}
                subline={m.manage_requested_at({ date: moment(request.since) })}
                wrap
              >
                {#snippet extra()}
                  {#if data.playerRatings}
                    <ScoreLine
                      rating={request.participantRating}
                      label={m.participant_rating()}
                      debut={m.participant_rating_new()}
                      suffix={m.participant_rating_as()}
                    />
                  {/if}
                {/snippet}
                {#snippet actions()}
                  <span class="flex gap-2">
                    <ActionForm
                      action="{tablePage}?/approve"
                      playerId={request.playerId}
                      next={here}
                      label={m.table_approve()}
                      buttonClass="{buttonClass('primary')} font-semibold"
                      success={m.toast_approved()}
                    />
                    <ConfirmAction
                      action="{tablePage}?/decline"
                      success={m.toast_declined()}
                      playerId={request.playerId}
                      next={here}
                      label={m.table_decline()}
                      title={m.confirm_decline_title({ player: atHandle(request.username) })}
                      username={request.username}
                      text={m.confirm_decline_text()}
                      class={secondary}
                    />
                  </span>
                {/snippet}
                {#if request.message}
                  <p class="basis-full text-sm whitespace-pre-line text-surface-700-300">
                    <span class="sr-only"
                      >{m.manage_request_message({ player: atHandle(request.username) })}:
                    </span>{request.message}
                  </p>
                {/if}
              </RosterRow>
            {/each}
          </ul>
        {:else if table.joinMode === 'approval'}
          <p class="mt-3 font-semibold">{m.manage_requests_none()}</p>
        {/if}
      </section>

      <section class={card}>
        <MAAccordion collapse="phone">
          <MAAccordionItem
            value="players"
            title={m.table_players()}
            summary={m.manage_seats_of({ taken, total: table.capacity })}
            summaryOnWide
            titleClass="text-xl font-semibold md:text-2xl"
          >
            <p>
              <span class="sr-only">{m.table_seats_taken({ taken, total: table.capacity })}</span
              ><SeatDots {taken} capacity={table.capacity} reserved={table.reserved} />
            </p>
            {#if table.minPlayers}
              <MinPlayersLine minPlayers={table.minPlayers} {taken} class="mt-2" />
            {/if}
            <ul class="mt-3">
              <RosterRow
                username={data.gm.username}
                avatarUrl={data.gm.avatarUrl}
                subline={m.manage_you()}
              >
                {#snippet actions()}
                  <span
                    class="chip h-7 shrink-0 rounded-lg bg-surface-wash px-2 text-xs font-semibold"
                    >{m.manage_gm_badge()}</span
                  >
                {/snippet}
              </RosterRow>
              {#each data.players as player (player.playerId)}
                <RosterRow
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  subline={m.manage_since({ date: day(player.since) })}
                >
                  {#snippet actions()}
                    <KebabMenu name={atHandle(player.username)} items={playerMenu(player)} />
                    <!-- Opened from the row's menu ("Mandar mensagem"). -->
                    <ActionForm action="?/message" playerId={player.playerId} class="hidden">
                      <button
                        id="message-{player.playerId}"
                        type="submit"
                        tabindex="-1"
                        aria-hidden="true"
                      ></button>
                    </ActionForm>
                  {/snippet}
                </RosterRow>
              {/each}
              {#each { length: table.seatsLeft }, i (i)}
                <li class={rosterRowClass}>
                  <span class="flex items-center gap-3">
                    <svg aria-hidden="true" viewBox="-30 -36 60 60" class="block size-10 shrink-0">
                      <Chair colour="stroke-lamp" free />
                    </svg>
                    <span>
                      <span class="block font-semibold">{m.manage_free_seat()}</span>
                      <span class="block text-sm text-muted">{m.manage_free_seat_hint()}</span>
                    </span>
                  </span>
                </li>
              {/each}
            </ul>
          </MAAccordionItem>
        </MAAccordion>
      </section>

      {#if data.canRatePlayers}
        <PlayerRatings next={here} goingOn={table.status !== 'concluded'} players={data.players} />
      {/if}

      <section class={card}>
        <MAAccordion>
          <MAAccordionItem
            value="activity"
            title={m.manage_activity()}
            summary={data.activity[0]
              ? m.manage_activity_summary({ when: moment(data.activity[0].at) })
              : m.manage_activity_none()}
            titleClass="text-xl font-semibold md:text-2xl"
          >
            {#if data.activity.length === 0}
              <p class="mt-3 text-muted">{m.manage_activity_none()}</p>
            {:else}
              <ul class="mt-3 grid gap-3">
                {#each data.activity as item, i (i)}
                  <li class="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      class="mt-1 block size-2 shrink-0 rounded-full bg-primary-500"
                    ></span>
                    <span>
                      <span class="block"
                        ><UserText text={activityText(item)} username={item.player} /></span
                      >
                      <span class="block text-sm text-muted">{moment(item.at)}</span>
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </MAAccordionItem>
        </MAAccordion>
      </section>
    </div>

    <aside
      aria-label={m.manage_summary()}
      class="self-start overflow-hidden rounded-lg border border-surface-200-800 bg-panel lg:sticky lg:top-6"
    >
      {#if table.imageUrl}
        <img
          src={table.imageUrl}
          alt=""
          referrerpolicy="no-referrer"
          class="aspect-5/2 w-full object-cover"
        />
      {/if}
      <div class="p-6">
        <SessionDate startsAt={table.startsAt} timezone={table.timezone} />

        <div class="mt-5 flex items-baseline justify-between gap-3">
          <p class="font-semibold {table.seatsLeft === 0 ? 'text-muted' : 'text-lamp'}">{seats}</p>
          <p class="text-sm font-semibold text-muted">
            {m.table_seats_taken({ taken, total: table.capacity })}
          </p>
        </div>

        <dl class="mt-4 grid grid-cols-3 border-t border-surface-200-800 text-sm">
          {#if table.platforms.length > 0}
            <SummaryRow label={m.form_platforms()} class="flex flex-wrap gap-1">
              {#each table.platforms as platform (platform.slug)}
                <span
                  class="chip h-7 rounded-lg border border-surface-200-800 px-2 text-xs font-semibold"
                  >{platform.name}</span
                >
              {/each}
            </SummaryRow>
          {/if}
          {#if table.tags.length > 0}
            <SummaryRow label={m.form_tags()} class="flex flex-wrap gap-1">
              {#each table.tags as tag (tag.slug)}
                <span class="chip h-7 rounded-lg bg-surface-wash px-2 text-xs font-semibold"
                  >{tag.name}</span
                >
              {/each}
            </SummaryRow>
          {/if}
          <SummaryRow label={m.manage_entry()}>
            {table.joinMode === 'approval' ? m.manage_entry_approval() : m.manage_entry_auto()}
          </SummaryRow>
          <SummaryRow label={m.table_schedule()}>
            {recurrence ? `${recurrence}, ` : ''}{formatHours(table.durationMinutes, locale)}
          </SummaryRow>
        </dl>

        <div class="mt-4">
          <p class="text-sm font-semibold text-muted">{m.manage_gm_rating()}</p>
          <GmRating rating={data.gmRating} class="mt-1 text-lg" />
        </div>

        <div class="mt-6 grid gap-2">
          {#if data.canEdit}
            <a
              href={editPage}
              class="btn h-12 w-full rounded-lg preset-filled-primary-500 font-semibold"
              >{m.table_edit()}</a
            >
          {/if}
          <a href={tablePage} class="{secondary} h-12 w-full">{m.manage_view_page()}</a>
          <a href={`/t/${table.slug}/chat`} class="{secondary} h-12 w-full"
            >{m.messages_table_chat()}</a
          >
        </div>
      </div>
    </aside>
  </div>

  <ConfirmDialog
    bind:open={disableOpen}
    action="{here}?/{table.status === 'draft' ? 'deleteDraft' : 'close'}"
    label={table.status === 'draft' ? m.table_delete_draft() : m.table_close()}
    title={table.status === 'draft' ? m.table_delete_draft_title() : m.table_close_title()}
    text={table.status === 'draft' ? m.table_delete_draft_text() : m.table_close_text()}
    success={table.status === 'draft' ? m.toast_table_deleted() : m.toast_table_closed()}
  />
  {#if removing.current}
    <ConfirmDialog
      bind:open={removing.open}
      action="{tablePage}?/remove"
      playerId={removing.current.playerId}
      next={here}
      label={m.table_remove()}
      title={m.confirm_remove_title({ player: atHandle(removing.current.username) })}
      username={removing.current.username}
      text={m.confirm_remove_text()}
      success={m.toast_removed()}
    />
  {/if}
</article>
