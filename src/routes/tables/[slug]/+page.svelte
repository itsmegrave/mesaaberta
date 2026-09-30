<script lang="ts">
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { queryClient } from '$lib/query/context';
  import { afterWrite } from '$lib/query/invalidate';
  const client = queryClient();
  import { pageQuery } from '$lib/query/page.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { atHandle } from '$lib/profile/handle';
  import { resolve } from '$app/paths';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { formatHours, formatSession } from '$lib/tables/format';
  import type { FormMessage } from '$lib/forms/message';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { ratingSchema } from '$lib/tables/rating';
  import { registrationError } from '$lib/tables/registration-errors';
  import { toast } from '$lib/toaster';
  import ActionForm from '$lib/components/ActionForm.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { data: serverData, form } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  // What the last seat action answered: from a submit with JavaScript (`onfail`), or from the page the server sent back without it.
  let failed = $state<FormMessage | null>(null);
  const problem = $derived(failed ?? form?.form?.message ?? null);

  const table = $derived(data.table);
  const locale = getLocale();

  const recurrence = $derived(
    table.kind === 'one_shot'
      ? m.table_recurrence_once()
      : table.everyWeeks === 1
        ? m.table_recurrence_weekly()
        : table.everyWeeks
          ? m.table_recurrence_weeks({ weeks: table.everyWeeks })
          : null,
  );
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const votes = (count: number) => (count === 1 ? m.rating_count_one() : m.rating_count({ count }));
  // svelte-ignore state_referenced_locally
  const rating = superForm(data.ratingForm, {
    validators: zod4Client(ratingSchema),
    resetForm: false,
    onResult({ result }) {
      if (result.type === 'redirect') {
        void afterWrite(client, 'table');
        toast.success(m.toast_rating_saved());
      }
    },
    onUpdated({ form: updated }) {
      if (updated.valid || !updated.message) return;
      toast.error(registrationError(updated.message.code, updated.message.retryAfter));
      failed = updated.message;
    },
  });
  const {
    form: ratingValues,
    errors: ratingErrors,
    enhance: ratingEnhance,
    submitting: ratingSubmitting,
    delayed: ratingDelayed,
    timeout: ratingTimeout,
  } = rating;
  const scoreFields = $derived([{ name: 'gmScore', label: m.rating_the_gm() }] as const);
  const seatColours = ['bg-success-500', 'bg-tertiary-400', 'bg-secondary-300'];

  // The calendar tile next to the session: "SÁB / 26 / SET", in the viewer's timezone.
  const dateBox = $derived.by(() => {
    if (!table.nextAt) return null;
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone: shownTimezone(table.timezone), ...options })
        .format(table.nextAt!)
        .replace('.', '');
    return {
      weekday: part({ weekday: 'short' }),
      day: part({ day: 'numeric' }),
      month: part({ month: 'short' }),
    };
  });

  const seats = $derived(
    table.seatsLeft === 0
      ? m.table_full()
      : table.seatsLeft === 1
        ? m.table_seat_left()
        : m.table_seats_left({ count: table.seatsLeft }),
  );
</script>

<svelte:head>
  <title>{table.title}</title>
  <meta name="description" content="{table.system.name}. {seats}." />
</svelte:head>
<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<article class="pt-2 pb-8 md:pt-6">
  <Breadcrumbs items={[{ label: m.nav_tables(), href: '/tables' }, { label: table.title }]} />
  <a
    href={localizedHref('/tables', locale)}
    class="inline-flex items-center gap-2 link-underline font-semibold decoration-primary-500 md:hidden"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class="shrink-0"><path d="M19 12H5M11 6l-6 6 6 6" /></svg
    >
    {m.table_back()}
  </a>

  <div class="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-3 lg:gap-16">
    <div class="min-w-0 lg:col-span-2">
      <p class="flex flex-wrap items-center gap-3">
        <span class="chip h-6 rounded-full preset-filled-primary-500 px-3 text-xs font-semibold">
          {table.kind === 'campaign' ? m.table_kind_campaign() : m.table_kind_one_shot()}
        </span>
        <a
          href="{localizedHref('/tables', locale)}?system={encodeURIComponent(table.system.slug)}"
          class="font-semibold text-link underline decoration-2 underline-offset-4"
        >
          {table.system.name}
        </a>
      </p>

      <h1 class="mt-3 text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
        {table.title}
      </h1>

      {#if table.tags.length > 0}
        <ul aria-label={m.form_tags()} class="mt-4 flex flex-wrap gap-2">
          {#each table.tags as tag (tag.slug)}
            <li>
              <a
                href="{localizedHref('/tables', locale)}?tag={encodeURIComponent(tag.slug)}"
                class="chip h-8 rounded-lg bg-surface-wash px-3 text-sm font-semibold hover:preset-tonal"
                >{tag.name}</a
              >
            </li>
          {/each}
        </ul>
      {/if}

      <div class="mt-5 flex flex-wrap items-center gap-4">
        <p>
          <span class="block text-sm font-semibold text-muted">{m.table_gm()}</span>
          <span class="text-lg font-semibold">{atHandle(table.gmName)}</span>
        </p>
        {#if data.ratings.gm.count > 0}
          <p
            class="inline-flex h-12 items-center gap-2 rounded-lg border border-surface-200-800 px-3"
          >
            <span class="sr-only"
              >{m.rating_gm_average()}: {number.format(data.ratings.gm.average ?? 0)} ({votes(
                data.ratings.gm.count,
              )})</span
            >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="fill-lamp"
              ><path
                d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z"
              /></svg
            >
            <strong aria-hidden="true" class="text-lg"
              >{number.format(data.ratings.gm.average ?? 0)}</strong
            >
            <span aria-hidden="true" class="text-sm text-muted"
              >({votes(data.ratings.gm.count)})</span
            >
          </p>
        {/if}
      </div>

      {#if data.canEdit}
        <p class="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {#if data.registrations}
            <a
              href={localizedHref(`/tables/${table.slug}/manage`, locale)}
              class="link-underline font-semibold">{m.dash_manage()}</a
            >
          {/if}
          <a
            href={localizedHref(`/tables/${table.slug}/edit`, locale)}
            class="link-underline font-semibold">{m.table_edit()}</a
          >
        </p>
      {/if}

      {#if table.imageUrl}
        <img
          src={table.imageUrl}
          alt=""
          referrerpolicy="no-referrer"
          class="mt-8 aspect-5/2 w-full rounded-lg object-cover"
        />
      {/if}

      <!-- User text is rendered as text and never as markup; line breaks are kept by the CSS. -->
      {#if table.description}
        <p class="mt-8 max-w-prose text-lg whitespace-pre-line">{table.description}</p>
      {/if}

      {#if table.extraInfo}
        <h2 class="mt-10 text-3xl font-semibold tracking-tight">{m.table_extra_info()}</h2>
        <p class="mt-2 max-w-prose whitespace-pre-line">{table.extraInfo}</p>
      {/if}

      {#if data.joinDetails}
        <section
          aria-labelledby="join-details"
          class="mt-8 max-w-prose rounded-lg border border-surface-200-800 bg-panel p-5"
        >
          <h2 id="join-details" class="text-xl font-semibold">{m.table_join_details()}</h2>
          <p class="mt-2 wrap-break-word whitespace-pre-line">{data.joinDetails}</p>
          <p class="mt-3 text-sm text-muted">{m.table_join_details_private()}</p>
        </section>
      {/if}
    </div>

    <aside
      aria-label={m.table_next_session()}
      class="self-start rounded-lg border border-surface-200-800 bg-panel p-6 lg:p-7"
    >
      <div class="flex items-start gap-4">
        {#if dateBox}
          <div
            aria-hidden="true"
            class="flex w-16 shrink-0 flex-col items-center rounded-lg preset-filled-primary-500 py-2 leading-none"
          >
            <span class="text-xs font-bold tracking-wide uppercase">{dateBox.weekday}</span>
            <span class="mt-1 text-3xl font-bold">{dateBox.day}</span>
            <span class="mt-1 text-xs font-bold tracking-wide uppercase">{dateBox.month}</span>
          </div>
        {/if}
        <div>
          <p class="text-sm font-semibold text-muted">{m.table_next_session()}</p>
          <p class="mt-1 text-xl leading-snug font-semibold">
            {#if table.nextAt}
              {formatSession(table.nextAt, shownTimezone(table.timezone), locale)}
            {:else}
              {m.table_no_more_sessions()}
            {/if}
          </p>
        </div>
      </div>

      <dl class="mt-6 grid grid-cols-3 border-t border-surface-200-800 text-sm">
        <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
          {m.table_modality()}
        </dt>
        <dd class="col-span-2 border-b border-surface-200-800 py-3">
          {table.modality === 'in_person'
            ? `${m.table_modality_in_person()} · ${table.locationArea}`
            : m.table_modality_online()}
        </dd>
        {#if table.platforms.length > 0}
          <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
            {m.form_platforms()}
          </dt>
          <dd class="col-span-2 flex flex-wrap gap-1 border-b border-surface-200-800 py-3">
            {#each table.platforms as platform (platform.slug)}
              <span
                class="chip h-7 rounded-lg border border-surface-200-800 px-2 text-xs font-semibold"
                >{platform.name}</span
              >
            {/each}
          </dd>
        {/if}
        <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
          {m.table_schedule()}
        </dt>
        <dd class="col-span-2 border-b border-surface-200-800 py-3">{recurrence}</dd>
        <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
          {m.table_duration()}
        </dt>
        <dd class="col-span-2 border-b border-surface-200-800 py-3">
          {formatHours(table.durationMinutes, locale)}
        </dd>
      </dl>

      <div class="mt-5 flex items-baseline justify-between gap-3">
        <p class="text-xl font-semibold {table.seatsLeft === 0 ? 'text-muted' : 'text-lamp'}">
          {seats}
        </p>
        <p class="text-sm font-semibold text-muted">
          {m.table_seats_taken({ taken: table.capacity - table.seatsLeft, total: table.capacity })}
        </p>
      </div>
      <p aria-hidden="true" class="mt-3 flex flex-wrap gap-2">
        {#each { length: table.capacity }, i (i)}
          {#if i < table.capacity - table.seatsLeft}
            <span
              class="flex size-8 items-center justify-center rounded-full {seatColours[
                i % seatColours.length
              ]}"><span class="size-3 rounded-full bg-surface-950/30"></span></span
            >
          {:else}
            <span class="block size-8 rounded-full border-2 border-dashed border-lamp bg-lamp-wash"
            ></span>
          {/if}
        {/each}
      </p>

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
            href="{resolve('/login')}?next={encodeURIComponent(
              localizedHref(`/tables/${table.slug}`, locale),
            )}"
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
            buttonClass="btn h-12 w-full rounded-lg border-2 border-surface-200-800 font-semibold hover:preset-tonal"
            success={m.toast_left()}
            onfail={(message) => (failed = message)}
          />
        {:else if data.myStatus === 'pending'}
          <p class="font-semibold">{m.table_request_pending()}</p>
          <ActionForm
            action="?/leave"
            class="mt-3"
            label={m.table_cancel_request()}
            buttonClass="btn h-12 w-full rounded-lg border-2 border-surface-200-800 font-semibold hover:preset-tonal"
            success={m.toast_request_withdrawn()}
            onfail={(message) => (failed = message)}
          />
        {:else if data.canJoin}
          <ActionForm
            action="?/join"
            onfail={(message) => (failed = message)}
            onsuccess={() =>
              table.joinMode === 'approval'
                ? toast.pending(m.toast_pending())
                : toast.success(m.toast_confirmed())}
            label={table.joinMode === 'approval' ? m.table_join_request() : m.table_join_now()}
            buttonClass="btn h-12 w-full rounded-lg preset-filled-primary-500 font-semibold"
          />
        {/if}
      </div>
      {#if data.isGm || data.myStatus === 'confirmed'}
        <a
          href={localizedHref(`/tables/${table.slug}/chat`, locale)}
          class="mt-3 btn h-12 w-full gap-2 rounded-lg border-2 border-surface-200-800 font-semibold hover:preset-tonal"
        >
          <Icon name="message-circle" size={18} />
          {m.messages_table_chat()}
        </a>
      {/if}
      {#if data.signedIn && !data.isGm}
        {#if data.gmAcceptsDirect}
          <ActionForm
            action="?/talk"
            class="mt-3"
            label={m.messages_talk_to_gm()}
            buttonClass="btn h-12 w-full rounded-lg border-2 border-surface-200-800 font-semibold hover:preset-tonal"
          />
        {:else}
          <button
            type="button"
            disabled
            aria-describedby="gm-dm-off"
            class="mt-3 btn h-12 w-full gap-2 rounded-lg border-2 border-surface-200-800 font-semibold"
          >
            <Icon name="message-circle" size={18} />
            {m.messages_talk_to_gm()}
          </button>
          <p id="gm-dm-off" class="mt-2 text-sm text-muted">{m.messages_gm_dm_off()}</p>
        {/if}
      {/if}
      <p class="mt-3 text-sm text-muted">
        {table.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}
      </p>
    </aside>
  </div>

  <!-- Only someone who played (a confirmed seat, and the first session is over) can rate. -->
  {#if data.canRate}
    <section id="avaliar" class="mt-12 max-w-2xl">
      <h2 class="text-2xl font-semibold">{m.rating_title()}</h2>
      <p class="mt-2 max-w-prose">{m.rating_lede()}</p>
      {#if data.myRating}<p role="status" class="mt-2 font-semibold">{m.rating_saved()}</p>{/if}

      <form method="POST" action="?/rate" use:ratingEnhance class="mt-4 grid gap-6">
        {#each scoreFields as { name, label } (name)}
          <fieldset>
            <legend class="font-semibold">{label}</legend>
            <div class="mt-2 flex flex-wrap gap-3">
              {#each [1, 2, 3, 4, 5] as score (score)}
                <label class="flex items-center gap-1">
                  <input
                    type="radio"
                    {name}
                    value={score}
                    required
                    bind:group={$ratingValues[name]}
                  />
                  <span aria-label={m.rating_score_label({ score })}>{score}</span>
                </label>
              {/each}
            </div>
            {#if $ratingErrors[name]}
              <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
                {m.table_error_invalid()}
              </p>
            {/if}
          </fieldset>
        {/each}

        <div>
          <label for="comment" class="label-text block font-semibold">{m.rating_comment()}</label>
          <textarea
            id="comment"
            name="comment"
            rows="3"
            maxlength="1000"
            bind:value={$ratingValues.comment}
            class="mt-1 textarea"></textarea>
        </div>

        <div>
          <SubmitButton
            submitting={$ratingSubmitting}
            delayed={$ratingDelayed}
            timeout={$ratingTimeout}
            class="btn preset-filled-primary-500"
          >
            {data.myRating ? m.rating_update() : m.rating_submit()}
          </SubmitButton>
        </div>
      </form>
    </section>
  {/if}

  <!-- The GM's (and admins') view: who has a seat and who is asking. Names are not public. -->
  {#if data.registrations}
    {@const players = data.registrations.filter((r) => r.status === 'confirmed')}
    {@const requests = data.registrations.filter((r) => r.status === 'pending')}

    <section class="mt-12 max-w-2xl">
      <h2 class="text-2xl font-semibold">{m.table_players()}</h2>
      {#if players.length === 0}
        <p class="mt-2">{m.table_no_players()}</p>
      {:else}
        <ul class="mt-3 grid gap-2">
          {#each players as player (player.playerId)}
            <li
              class="flex items-center justify-between gap-4 rounded-lg border border-surface-200-800 bg-panel p-3"
            >
              <span>{atHandle(player.username)}</span>
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

      {#if requests.length > 0}
        <h2 class="mt-8 text-2xl font-semibold">{m.table_requests()}</h2>
        <ul class="mt-3 grid gap-2">
          {#each requests as request (request.playerId)}
            <li
              class="flex items-center justify-between gap-4 rounded-lg border border-surface-200-800 bg-panel p-3"
            >
              <span>{atHandle(request.username)}</span>
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
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</article>
