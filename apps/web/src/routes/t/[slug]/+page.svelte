<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import RichText from '#lib/components/ui/RichText.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { formatHours } from '@mesaaberta/core/tables/format';
  import { tableStatusLabel } from '#lib/tables/status.js';
  import type { FormMessage } from '#lib/forms/message.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { ratingSchema } from '@mesaaberta/core/tables/rating';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import ReportDialog from './components/ReportDialog.svelte';
  import { toast } from '#lib/toaster.js';
  import ActionForm from '#lib/components/ActionForm.svelte';
  import JoinRequestDialog from './components/JoinRequestDialog.svelte';
  import GmRating from '#lib/components/ui/GmRating.svelte';
  import FollowButton from '#lib/components/FollowButton.svelte';
  import StarRating from '#lib/components/ui/StarRating.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import MAAccordionItem from '#lib/components/ui/MAAccordionItem.svelte';
  import KebabMenu, { type KebabItem } from '#lib/components/ui/KebabMenu.svelte';
  import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
  import SeatDots from '#lib/components/ui/SeatDots.svelte';
  import DraftNotice from './components/DraftNotice.svelte';
  import SessionDate from './components/ui/SessionDate.svelte';
  import SummaryRow from './components/ui/SummaryRow.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import { modalityIcon } from '#lib/tables/modality-icon.js';
  import { kindLabel, scheduleLabel, seatsLeftLabel } from '#lib/tables/format.js';
  import MinPlayersLine from '#lib/components/ui/MinPlayersLine.svelte';

  let { data: serverData, form } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  // What the last seat action answered: from a submit with JavaScript (`onfail`), or from the page the server sent back without it.
  let failed = $state<FormMessage | null>(null);
  // The report dialog shows its own errors; only the seat actions answer with a `message`.
  const problem = $derived(
    failed ?? (form?.form && 'message' in form.form ? form.form.message : null) ?? null,
  );

  const table = $derived(data.table);
  const locale = getLocale();

  const recurrence = $derived(scheduleLabel(table.kind, table.everyWeeks, table.plannedSessions));
  // svelte-ignore state_referenced_locally
  const rating = actionForm({
    initial: data.ratingForm.data,
    schema: ratingSchema,
    domain: 'table',
    errorMessage: () => registrationError('invalid'),
    onSuccess: () => toast.success(m.toast_rating_saved()),
    onFailure(updated) {
      if (!updated?.message) return;
      toast.error(registrationError(updated.message.code, updated.message.retryAfter));
      failed = updated.message;
    },
  });
  const scoreFields = $derived([{ name: 'gmScore', label: m.rating_the_gm() }] as const);

  // Past the open state (waiting for the GM, concluded or not held) the date stays and says so.
  const stateLabel = $derived(tableStatusLabel(table.status));

  // The title's "3 dots": what a GM can do with the table, or what anyone else can do about it.
  let disableOpen = $state(false);
  let reportOpen = $state(false);
  function copyLink() {
    return copyText(new URL(`/t/${table.slug}`, page.url.origin).href, m.toast_link_copied());
  }
  const menu = $derived.by(() => {
    const items: KebabItem[] = [];
    if (data.canEdit) {
      items.push({
        id: 'edit',
        label: m.menu_edit(),
        icon: 'square-pen',
        href: `/t/${table.slug}/edit`,
      });
    }
    // The players stay reachable once the table is frozen: that is where the GM sees the rating.
    if (data.canManage) {
      items.push({
        id: 'players',
        label: m.menu_players(),
        icon: 'game-icons:meeple',
        href: `/t/${table.slug}/manage`,
      });
    }
    items.push({ id: 'copy', label: m.menu_copy_link(), icon: 'copy', onselect: copyLink });
    if (data.signedIn && !data.isGm && data.gmAcceptsDirect) {
      items.push({
        id: 'talk',
        label: m.menu_message_gm(),
        icon: 'game-icons:scroll-quill',
        onselect: () => document.getElementById('talk-to-gm')?.click(),
      });
    }
    if (data.isGm && ['active', 'draft', 'awaiting_confirmation'].includes(table.status)) {
      items.push({
        id: 'disable',
        label: table.status === 'draft' ? m.menu_delete_draft() : m.menu_close_table(),
        icon: 'trash',
        destructive: true,
        onselect: () => (disableOpen = true),
      });
    }
    if (data.reportTargets.table || data.reportTargets.people.length > 0) {
      items.push({
        id: 'report',
        label: m.menu_report(),
        icon: 'flag',
        destructive: true,
        onselect: () => (reportOpen = true),
      });
    }
    return items;
  });

  const taken = $derived(table.taken);
  const seats = $derived(seatsLeftLabel(table.seatsLeft));
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<article class="pt-2 pb-8 md:pt-6">
  <Breadcrumbs items={[{ label: m.nav_tables(), href: '/t' }, { label: table.title }]} />

  <div class="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-3 lg:gap-16">
    <div class="min-w-0 lg:col-span-2">
      <p class="flex flex-wrap items-center gap-3">
        <Pill>{kindLabel(table.kind)}</Pill>
        <a
          href="/t?system={encodeURIComponent(table.system.slug)}"
          class="font-semibold text-link underline decoration-2 underline-offset-4"
        >
          {table.system.name}
        </a>
      </p>

      <div class="mt-3 flex items-start justify-between gap-3">
        <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
          {table.title}
        </h1>
        <KebabMenu name={table.title} items={menu} />
      </div>

      {#if data.canEdit && table.status === 'draft'}
        <DraftNotice
          action="{`/t/${table.slug}/manage`}?/publish"
          next={`/t/${table.slug}`}
          waiting={data.systemWaiting}
        />
      {/if}

      {#if table.tags.length > 0}
        <ul aria-label={m.form_tags()} class="mt-4 flex flex-wrap gap-2">
          {#each table.tags as tag (tag.slug)}
            <li>
              <a
                href="/t?tag={encodeURIComponent(tag.slug)}"
                class="chip h-8 rounded-lg bg-surface-wash px-3 text-sm font-semibold hover:preset-tonal"
                >{tag.name}</a
              >
            </li>
          {/each}
        </ul>
      {/if}

      <!-- Quem mestra: the picture, the label over the handle, then the rating pill. -->
      <div class="mt-5 flex flex-wrap items-center gap-4">
        <div class="flex min-w-0 items-center gap-4">
          <MAAvatar src={data.gm?.avatarUrl ?? null} name={table.gmName} size={44} />
          <p class="min-w-0">
            <span class="block text-xs font-semibold text-muted">{m.table_gm()}</span>
            {#if data.gmUsername}
              <a
                href={`/u/${encodeURIComponent(data.gmUsername)}`}
                class="text-lg font-semibold text-surface-950-50 underline decoration-surface-200-800 underline-offset-3 hover:decoration-primary-500"
                >{atHandle(table.gmName)}</a
              >
            {:else}
              <span class="text-lg font-semibold">{atHandle(table.gmName)}</span>
            {/if}
          </p>
        </div>
        <GmRating rating={table.gmRating} variant="pill" class="ml-2" />
        {#if data.follow && data.gmUsername}
          <FollowButton
            size="sm"
            profileId={data.follow.profileId}
            username={data.gmUsername}
            following={data.follow.following}
            signedIn={data.follow.signedIn}
          />
        {/if}
      </div>

      {#if table.imageUrl}
        <img
          src={table.imageUrl}
          alt=""
          width="1200"
          height="480"
          decoding="async"
          referrerpolicy="no-referrer"
          class="mt-8 aspect-5/2 w-full rounded-lg object-cover"
        />
      {/if}

      <!-- Rich text: RichText cleans it to a small set of tags before showing it. -->
      {#if table.description}
        <RichText html={table.description} class="mt-8 max-w-prose text-lg" />
      {/if}

      {#if table.extraInfo}
        <MAAccordion
          collapse="phone"
          class="mt-10 max-w-prose border-y border-surface-200-800 md:border-0"
        >
          <MAAccordionItem
            value="extra"
            title={m.table_extra_info()}
            summary={m.table_extra_info_summary()}
            titleClass="text-xl font-semibold tracking-tight md:text-3xl"
          >
            <RichText html={table.extraInfo} />
          </MAAccordionItem>
        </MAAccordion>
      {/if}

      {#if data.joinDetails}
        <section
          aria-labelledby="join-details"
          class="mt-8 max-w-prose rounded-lg border border-surface-200-800 bg-panel p-5"
        >
          <h2 id="join-details" class="text-xl font-semibold">{m.table_join_details()}</h2>
          <RichText html={data.joinDetails} class="mt-2" />
          <p class="mt-3 text-sm text-muted">{m.table_join_details_private()}</p>
        </section>
      {/if}
    </div>

    <aside
      aria-label={m.table_next_session()}
      class="self-start rounded-lg border border-surface-200-800 bg-panel p-6 lg:p-7"
    >
      <SessionDate startsAt={table.startsAt} timezone={table.timezone} {stateLabel} large />

      <dl class="mt-6 grid grid-cols-3 border-t border-surface-200-800 text-sm">
        <SummaryRow label={m.table_modality()} class="flex items-center gap-2">
          <Icon name={modalityIcon(table.modality)} size={18} />
          {table.modality === 'in_person'
            ? `${m.table_modality_in_person()} · ${table.locationArea}`
            : m.table_modality_online()}
        </SummaryRow>
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
        <SummaryRow label={m.table_schedule()}>{recurrence}</SummaryRow>
        <SummaryRow label={m.table_duration()}>
          {formatHours(table.durationMinutes, locale)}
        </SummaryRow>
      </dl>

      <div class="mt-5 flex items-baseline justify-between gap-3">
        <p class="text-xl font-semibold {table.seatsLeft === 0 ? 'text-muted' : 'text-lamp'}">
          {seats}
        </p>
        <p class="text-sm font-semibold text-muted">
          {m.table_seats_taken({ taken: table.capacity - table.seatsLeft, total: table.capacity })}
        </p>
      </div>
      <p class="mt-3">
        <SeatDots taken={table.capacity - table.seatsLeft} capacity={table.capacity} size={34} />
      </p>
      {#if table.minPlayers}
        <MinPlayersLine minPlayers={table.minPlayers} {taken} class="mt-3" />
      {/if}

      {#if problem}
        <p role="alert" class="mt-5 font-semibold text-error-700-300">
          {registrationError(problem.code, problem.retryAfter)}
        </p>
      {/if}

      <!-- What this visitor can do about a seat. The server checks it again on every action. -->
      <div class="mt-5">
        {#if data.isGm}
          <p class="font-semibold">{m.table_you_are_gm()}</p>
        {:else if !data.signedIn}
          <a
            href="{resolve('login')}?next={encodeURIComponent(`/t/${table.slug}`)}"
            class="btn h-12 w-full rounded-lg preset-filled-primary-500 font-semibold"
          >
            {m.table_sign_in_to_join()}
          </a>
        {:else if data.myStatus === 'confirmed'}
          <p class="font-semibold">{m.table_you_are_in()}</p>
          <ActionForm
            action="?/leave"
            class="mt-3"
            label={m.table_leave()}
            buttonClass="btn h-12 w-full rounded-lg btn-secondary font-semibold"
            success={m.toast_left()}
            onfail={(message) => (failed = message)}
          />
        {:else if data.myStatus === 'pending'}
          <p class="font-semibold">{m.table_request_pending()}</p>
          <ActionForm
            action="?/leave"
            class="mt-3"
            label={m.table_cancel_request()}
            buttonClass="btn h-12 w-full rounded-lg btn-secondary font-semibold"
            success={m.toast_request_withdrawn()}
            onfail={(message) => (failed = message)}
          />
        {:else if data.invitation}
          <a
            href={`/u/profile/invitations/${data.invitation.id}`}
            class="{buttonClass('primary')} w-full font-semibold">{m.invitation_review()}</a
          >
        {:else if data.canJoin && table.joinMode === 'approval'}
          <JoinRequestDialog
            onfail={(message) => (failed = message)}
            triggerClass="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 font-semibold"
          />
        {:else if data.canJoin}
          <ActionForm
            action="?/join"
            onfail={(message) => (failed = message)}
            onsuccess={() => toast.success(m.toast_confirmed())}
            label={m.table_join_now()}
            icon="game-icons:bar-stool"
            buttonClass="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 font-semibold"
          />
        {/if}
      </div>
      {#if data.isGm || data.myStatus === 'confirmed'}
        <a
          href={`/t/${table.slug}/chat`}
          class="mt-3 btn h-12 w-full gap-2 rounded-lg btn-secondary font-semibold"
        >
          <Icon name="game-icons:scroll-quill" size={18} />
          {m.messages_table_chat()}
        </a>
      {/if}
      {#if data.signedIn && !data.isGm && data.gmAcceptsDirect}
        <!-- Opened from the title menu ("Mandar mensagem para quem mestra"). -->
        <ActionForm action="?/talk" class="hidden">
          <button id="talk-to-gm" type="submit" tabindex="-1" aria-hidden="true"></button>
        </ActionForm>
      {/if}
      <p class="mt-3 text-sm text-muted">
        {table.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}
      </p>
    </aside>
  </div>

  <ReportDialog targets={data.reportTargets} trigger={false} bind:open={reportOpen} />
  {#if data.isGm}
    <ConfirmDialog
      bind:open={disableOpen}
      action="{`/t/${table.slug}/manage`}?/{table.status === 'draft' ? 'deleteDraft' : 'close'}"
      label={table.status === 'draft' ? m.table_delete_draft() : m.table_close()}
      title={table.status === 'draft' ? m.table_delete_draft_title() : m.table_close_title()}
      text={table.status === 'draft' ? m.table_delete_draft_text() : m.table_close_text()}
      success={table.status === 'draft' ? m.toast_table_deleted() : m.toast_table_closed()}
      onfail={(message) => (failed = message)}
    />
  {/if}

  <!-- Their rating, once given: final, so it is only shown. -->
  {#if data.myRating}
    <section id="avaliar" class="mt-12 max-w-2xl">
      <h2 class="text-2xl font-semibold">{m.rating_given_title()}</h2>
      <p class="mt-2 flex items-center gap-2">
        <Icon name="star" size={24} class="text-lamp" />
        <strong class="text-2xl tabular-nums"
          >{m.rating_score_label({ score: data.myRating.gmScore })}</strong
        >
      </p>
      {#if data.myRating.comment}
        <p class="mt-2 max-w-prose whitespace-pre-line">{data.myRating.comment}</p>
      {/if}
      <p class="mt-3 text-sm text-muted">{m.rating_final()}</p>
    </section>
  {/if}

  <!-- Only someone who played (a confirmed seat, and the GM confirmed the session) can rate, once. -->
  {#if data.canRate}
    <section id="avaliar" class="mt-12 max-w-2xl">
      <h2 class="text-2xl font-semibold">{m.rating_title()}</h2>
      <p class="mt-2 max-w-prose">{m.rating_lede()}</p>

      <MAForm action="?/rate" onsubmit={rating.submit} class="mt-4 grid gap-6">
        {#each scoreFields as { name, label } (name)}
          <div>
            <StarRating
              {name}
              {label}
              value={rating.values[name]}
              invalid={!!rating.errors[name]}
              onchange={(score) => rating.change(name, score)}
            />
            {#if rating.errors[name]}
              <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
                {m.table_error_invalid()}
              </p>
            {/if}
          </div>
        {/each}

        <div>
          <label for="comment" class="label-text block font-semibold">{m.rating_comment()}</label>
          <MATextArea
            id="comment"
            name="comment"
            rows={3}
            maxlength={1000}
            bind:value={() => rating.values.comment, (value) => rating.change('comment', value)}
            class="mt-1 textarea"
          />
          <!-- Off by default: the comment stays with the player unless they choose to show it. -->
          <label class="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="commentPublic"
              value="true"
              aria-describedby="comment-public-hint"
              checked={rating.values.commentPublic}
              onchange={(event) => rating.change('commentPublic', event.currentTarget.checked)}
              class="checkbox"
            />
            {m.rating_comment_public()}
          </label>
          <p id="comment-public-hint" class="ml-8 text-sm text-muted">
            {m.rating_comment_public_hint()}
          </p>
        </div>

        <div>
          <MAButton
            type="submit"
            size="custom"
            controller={rating}
            class="btn gap-2 preset-filled-primary-500"
          >
            {m.rating_submit()}
          </MAButton>
        </div>
      </MAForm>
    </section>
  {/if}

  <!-- The GM's (and admins') view: who has a seat and who is asking. Names are not public. -->
  {#if data.registrations}
    {@const players = data.registrations.filter((r) => r.status === 'confirmed')}
    {@const requests = data.registrations.filter((r) => r.status === 'pending')}

    <section class="mt-12 max-w-2xl">
      <MAAccordion collapse="phone" class="border-y border-surface-200-800 md:border-0">
        <MAAccordionItem
          value="players"
          title={m.table_players()}
          summary={m.table_players_summary({ count: players.length })}
          titleClass="text-xl font-semibold md:text-2xl"
        >
          {#if players.length === 0}
            <p>{m.table_no_players()}</p>
          {:else}
            <ul class="grid gap-2">
              {#each players as player (player.playerId)}
                <li
                  class="flex items-center justify-between gap-4 rounded-lg border border-surface-200-800 bg-panel p-3"
                >
                  <span><UserLink username={player.username} /></span>
                  <ActionForm
                    action="?/remove"
                    playerId={player.playerId}
                    label={m.table_remove()}
                    buttonClass="btn preset-tonal-error btn-sm"
                    success={m.toast_removed()}
                    onfail={(message) => (failed = message)}
                  />
                </li>
              {/each}
            </ul>
          {/if}
        </MAAccordionItem>
      </MAAccordion>

      {#if requests.length > 0}
        <h2 class="mt-8 text-2xl font-semibold">{m.table_requests()}</h2>
        <ul class="mt-3 grid gap-2">
          {#each requests as request (request.playerId)}
            <li
              class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-surface-200-800 bg-panel p-3"
            >
              <span><UserLink username={request.username} /></span>
              <div class="flex gap-4">
                <ActionForm
                  action="?/approve"
                  playerId={request.playerId}
                  label={m.table_approve()}
                  buttonClass="btn preset-tonal-primary btn-sm"
                  success={m.toast_approved()}
                  onfail={(message) => (failed = message)}
                />
                <ActionForm
                  action="?/decline"
                  playerId={request.playerId}
                  label={m.table_decline()}
                  buttonClass="btn preset-tonal-error btn-sm"
                  success={m.toast_declined()}
                  onfail={(message) => (failed = message)}
                />
              </div>
              {#if request.message}
                <p class="basis-full text-sm whitespace-pre-line text-surface-700-300">
                  {request.message}
                </p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</article>
