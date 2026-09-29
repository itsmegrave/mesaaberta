<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { Collapsible } from '@skeletonlabs/skeleton-svelte';
  import ActionForm from '$lib/components/ActionForm.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import ConfirmAction from '$lib/components/ConfirmAction.svelte';
  import SeatDots from '$lib/components/SeatDots.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle } from '$lib/profile/handle';
  import { formatDuration, formatSession } from '$lib/tables/format';
  import { shownTimezone } from '$lib/time/shown-timezone';
  import { onMount } from 'svelte';

  let { data } = $props();

  // Recent activity is open on a wide screen and folded under the rest on a phone. Open until then,
  // so it is there without JavaScript.
  let activityOpen = $state(true);
  onMount(() => (activityOpen = matchMedia('(min-width: 1024px)').matches));

  const locale = getLocale();
  const table = $derived(data.table);
  const zone = $derived(shownTimezone(table.timezone));
  const here = $derived(localizedHref(`/tables/${table.slug}/manage`, locale));
  const tablePage = $derived(localizedHref(`/tables/${table.slug}`, locale));
  const editPage = $derived(localizedHref(`/tables/${table.slug}/edit`, locale));
  const taken = $derived(table.capacity - table.seatsLeft);

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

  const dateBox = $derived.by(() => {
    if (!table.nextAt) return null;
    const part = (options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, { timeZone: zone, ...options })
        .format(table.nextAt!)
        .replace('.', '');
    return {
      weekday: part({ weekday: 'short' }),
      day: part({ day: 'numeric' }),
      month: part({ month: 'short' }),
    };
  });
  const recurrence = $derived(
    table.kind === 'one_shot'
      ? m.table_recurrence_once()
      : table.everyWeeks === 1
        ? m.table_recurrence_weekly()
        : table.everyWeeks
          ? m.table_recurrence_weeks({ weeks: table.everyWeeks })
          : m.table_recurrence_weekly(),
  );
  const seats = $derived(
    table.seatsLeft === 0
      ? m.table_full()
      : table.seatsLeft === 1
        ? m.table_seat_left()
        : m.table_seats_left({ count: table.seatsLeft }),
  );
  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const votes = (count: number) => (count === 1 ? m.rating_count_one() : m.rating_count({ count }));

  const activityText = (item: (typeof data.activity)[number]) => {
    const player = atHandle(item.player ?? '');
    switch (item.type) {
      case 'TableCreated':
        return m.manage_activity_table_created();
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
  const row =
    'flex items-center justify-between gap-3 border-b border-surface-200-800 py-3 last:border-b-0';
  const secondary =
    'btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
</script>

<svelte:head>
  <title>{m.manage_title({ title: table.title })}</title>
</svelte:head>

<article class="pt-2 pb-8 md:pt-6">
  <Breadcrumbs
    items={[
      { label: m.nav_my_tables(), href: '/account/tables' },
      { label: table.title, href: `/tables/${table.slug}` },
      { label: m.manage_breadcrumb() },
    ]}
  />
  <a
    href={localizedHref('/account/tables', locale)}
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
    {m.manage_back()}
  </a>

  <p class="mt-6 flex flex-wrap items-center gap-3 lg:mt-8">
    <span class="chip h-6 rounded-full preset-filled-primary-500 px-3 text-xs font-semibold"
      >{m.manage_you_are_gm()}</span
    >
    <span class="font-semibold text-muted"
      >{table.system.name} · {table.kind === 'campaign'
        ? m.table_kind_campaign()
        : m.table_kind_one_shot()}</span
    >
  </p>
  <h1 class="mt-3 text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {table.title}
  </h1>

  <div
    class="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-surface-200-800"
  >
    <nav aria-label={m.manage_sections()} class="flex gap-6">
      <a
        href={here}
        aria-current="page"
        class="-mb-px inline-flex h-12 items-center gap-2 border-b-2 border-primary-500 font-semibold no-underline"
      >
        {m.manage_tab_players()}
        {#if data.requests.length > 0}
          <span
            class="chip h-6 min-w-6 rounded-full preset-filled-primary-500 px-2 text-xs font-bold"
            >{data.requests.length}</span
          >
        {/if}
      </a>
      <a
        href={editPage}
        class="-mb-px inline-flex h-12 items-center border-b-2 border-transparent font-semibold text-muted no-underline hover:text-surface-950-50"
        >{m.table_edit()}</a
      >
    </nav>
    <a href={tablePage} class="hidden link-underline font-semibold sm:inline"
      >{m.manage_view_page()}</a
    >
  </div>

  <div class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12">
    <div class="grid min-w-0 content-start gap-8 lg:col-span-2">
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
              <li class="{row} flex-wrap">
                <span class="flex min-w-0 items-center gap-3">
                  <Avatar src={request.avatarUrl} name={request.username} size={40} />
                  <span class="min-w-0">
                    <span class="block truncate font-semibold">{atHandle(request.username)}</span>
                    <span class="block text-sm text-muted"
                      >{m.manage_requested_at({ date: moment(request.since) })}</span
                    >
                  </span>
                </span>
                <span class="flex gap-2">
                  <ActionForm
                    action="{tablePage}?/approve"
                    playerId={request.playerId}
                    next={here}
                    label={m.table_approve()}
                    buttonClass="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
                    success={m.toast_approved()}
                  />
                  <ConfirmAction
                    action="{tablePage}?/decline"
                    success={m.toast_declined()}
                    playerId={request.playerId}
                    next={here}
                    label={m.table_decline()}
                    title={m.confirm_decline_title({ player: atHandle(request.username) })}
                    text={m.confirm_decline_text()}
                    class={secondary}
                  />
                </span>
              </li>
            {/each}
          </ul>
        {:else if table.joinMode === 'approval'}
          <p class="mt-3 font-semibold">{m.manage_requests_none()}</p>
        {/if}
      </section>

      <section aria-labelledby="players" class={card}>
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="players" class="text-2xl font-semibold">{m.table_players()}</h2>
          <span class="font-semibold text-muted"
            >{m.manage_seats_of({ taken, total: table.capacity })}</span
          >
        </div>
        <p class="mt-3">
          <span class="sr-only">{m.table_seats_taken({ taken, total: table.capacity })}</span
          ><SeatDots {taken} capacity={table.capacity} />
        </p>
        <ul class="mt-3">
          <li class={row}>
            <span class="flex min-w-0 items-center gap-3">
              <Avatar src={data.gm.avatarUrl} name={data.gm.username} size={40} />
              <span class="min-w-0">
                <span class="block truncate font-semibold">{atHandle(data.gm.username)}</span>
                <span class="block text-sm text-muted">{m.manage_you()}</span>
              </span>
            </span>
            <span class="chip h-7 shrink-0 rounded-lg bg-surface-wash px-2 text-xs font-semibold"
              >{m.manage_gm_badge()}</span
            >
          </li>
          {#each data.players as player (player.playerId)}
            <li class={row}>
              <span class="flex min-w-0 items-center gap-3">
                <Avatar src={player.avatarUrl} name={player.username} size={40} />
                <span class="min-w-0">
                  <span class="block truncate font-semibold">{atHandle(player.username)}</span>
                  <span class="block text-sm text-muted"
                    >{m.manage_since({ date: day(player.since) })}</span
                  >
                </span>
              </span>
              <ConfirmAction
                action="{tablePage}?/remove"
                success={m.toast_removed()}
                playerId={player.playerId}
                next={here}
                label={m.table_remove()}
                title={m.confirm_remove_title({ player: atHandle(player.username) })}
                text={m.confirm_remove_text()}
                class={secondary}
              />
            </li>
          {/each}
          {#each { length: table.seatsLeft }, i (i)}
            <li class={row}>
              <span class="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  class="block size-10 shrink-0 rounded-full border-2 border-dashed border-lamp bg-lamp-wash"
                ></span>
                <span>
                  <span class="block font-semibold">{m.manage_free_seat()}</span>
                  <span class="block text-sm text-muted">{m.manage_free_seat_hint()}</span>
                </span>
              </span>
            </li>
          {/each}
        </ul>
      </section>

      <section aria-labelledby="activity" class={card}>
        <Collapsible
          open={activityOpen}
          onOpenChange={(details) => (activityOpen = details.open)}
          class="grid"
        >
          <Collapsible.Trigger class="flex w-full items-center justify-between gap-3 text-left">
            <h2 id="activity" class="text-2xl font-semibold">{m.manage_activity()}</h2>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="shrink-0 transition-transform {activityOpen ? 'rotate-180' : ''}"
              ><path d="M6 9l6 6 6-6" /></svg
            >
          </Collapsible.Trigger>
          <Collapsible.Content>
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
                      <span class="block">{activityText(item)}</span>
                      <span class="block text-sm text-muted">{moment(item.at)}</span>
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </Collapsible.Content>
        </Collapsible>
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
        <div class="flex items-start gap-4">
          {#if dateBox}
            <div
              aria-hidden="true"
              class="flex w-16 shrink-0 flex-col items-center rounded-lg preset-filled-primary-500 py-2 leading-none"
            >
              <span class="text-xs font-bold tracking-wide uppercase">{dateBox.weekday}</span>
              <span class="mt-1 text-2xl font-bold">{dateBox.day}</span>
              <span class="mt-1 text-xs font-bold tracking-wide uppercase">{dateBox.month}</span>
            </div>
          {/if}
          <div>
            <p class="text-sm font-semibold text-muted">{m.table_next_session()}</p>
            <p class="mt-1 text-lg leading-snug font-semibold">
              {#if table.nextAt}
                {formatSession(table.nextAt, zone, locale)}
              {:else}
                {m.table_no_more_sessions()}
              {/if}
            </p>
          </div>
        </div>

        <div class="mt-5 flex items-baseline justify-between gap-3">
          <p class="font-semibold {table.seatsLeft === 0 ? 'text-muted' : 'text-lamp'}">{seats}</p>
          <p class="text-sm font-semibold text-muted">
            {m.table_seats_taken({ taken, total: table.capacity })}
          </p>
        </div>

        <dl class="mt-4 grid grid-cols-3 border-t border-surface-200-800 text-sm">
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
          {#if table.tags.length > 0}
            <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
              {m.form_tags()}
            </dt>
            <dd class="col-span-2 flex flex-wrap gap-1 border-b border-surface-200-800 py-3">
              {#each table.tags as tag (tag.slug)}
                <span class="chip h-7 rounded-lg bg-surface-wash px-2 text-xs font-semibold"
                  >{tag.name}</span
                >
              {/each}
            </dd>
          {/if}
          <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
            {m.manage_entry()}
          </dt>
          <dd class="col-span-2 border-b border-surface-200-800 py-3">
            {table.joinMode === 'approval' ? m.manage_entry_approval() : m.manage_entry_auto()}
          </dd>
          <dt class="border-b border-surface-200-800 py-3 pr-6 font-semibold text-muted">
            {m.table_schedule()}
          </dt>
          <dd class="col-span-2 border-b border-surface-200-800 py-3">
            {recurrence}, {formatDuration(table.durationMinutes)}
          </dd>
        </dl>

        <div class="mt-4">
          <p class="text-sm font-semibold text-muted">{m.manage_gm_rating()}</p>
          {#if data.gmRating.count > 0}
            <p class="mt-1 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="fill-lamp"
                ><path
                  d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z"
                /></svg
              >
              <strong class="text-lg">{number.format(data.gmRating.average ?? 0)}</strong>
              <span class="text-sm text-muted">({votes(data.gmRating.count)})</span>
            </p>
          {:else}
            <p class="mt-1">{m.manage_gm_rating_none()}</p>
          {/if}
        </div>

        <div class="mt-6 grid gap-2">
          <a
            href={editPage}
            class="btn h-12 w-full rounded-lg preset-filled-primary-500 font-semibold"
            >{m.table_edit()}</a
          >
          <a href={tablePage} class="{secondary} h-12 w-full">{m.manage_view_page()}</a>
        </div>
      </div>
    </aside>
  </div>
</article>
