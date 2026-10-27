<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import { navigating, page, updated } from '$app/state';
  import AppUpdateNotice from '#lib/components/shell/AppUpdateNotice.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import NotificationAction from '#lib/components/NotificationAction.svelte';
  import NotificationIcon from '#lib/components/ui/NotificationIcon.svelte';
  import type { NotificationCategory } from '@mesaaberta/core/notifications/kinds';
  import { isAlert, notificationIcon, notificationText } from '#lib/notifications/text.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { feedHref, type FeedQuery } from '#lib/notifications/feed-href.js';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while. Coming back to the same query (after marking read, say) keeps the list.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const locale = getLocale();
  // Every form comes back to the filter it was sent from.
  const here = $derived(page.url.pathname + page.url.search);

  // Only the categories that have events today; catalog and moderation join the filters with the
  // slices that write them. "Avisos" holds the announcements and the new-version item.
  const filters: { category: NotificationCategory | null; label: () => string }[] = [
    { category: null, label: m.notifications_filter_all },
    { category: 'table', label: m.notifications_filter_table },
    { category: 'registration', label: m.notifications_filter_registration },
    { category: 'rating', label: m.notifications_filter_rating },
    { category: 'messages', label: m.notifications_filter_messages },
    { category: 'achievements', label: m.notifications_filter_achievements },
    { category: 'system', label: m.notifications_filter_system },
  ];

  // The feed with this filter, on page 1 unless another is given (`?page=N`, none for the first).
  const hrefFor = (over: Partial<FeedQuery> = {}) =>
    feedHref({ category: data.category, unread: data.unread, page: 1, ...over });
  const pageLink = `${buttonClass('secondary', 'md')} text-sm font-semibold`;
  const when = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: shownTimezone('America/Sao_Paulo'),
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

  // Round filter pills, as on the layout: the picked one is filled.
  const chip =
    'btn h-8 shrink-0 rounded-full border border-surface-200-800 px-3 text-sm font-semibold hover:preset-tonal aria-[current=page]:border-primary-500 aria-[current=page]:preset-filled-primary-500';
</script>

<svelte:head>
  <title>{m.notifications_title()}</title>
</svelte:head>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs class="mb-8" items={[{ label: m.notifications_title() }]} />
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
        {m.notifications_title()}
      </h1>
      <p class="mt-2 max-w-md text-base text-muted md:mt-3 md:text-xl">
        {m.notifications_lede()}
      </p>
    </div>
    {#if data.unreadTotal > 0}
      <NotificationAction
        action="readAll"
        next={here}
        until={data.seenAt}
        buttonClass="btn h-11 rounded-lg border-2 border-primary-500 px-6 font-semibold"
      >
        {m.notifications_mark_all()}
      </NotificationAction>
    {/if}
  </div>

  <nav aria-label={m.notifications_filter_label()} class="mt-8">
    <ul class="flex flex-wrap gap-2">
      {#each filters.filter((filter) => filter.category !== 'achievements' || data.withAchievements) as filter (filter.category)}
        <li>
          <a
            href={hrefFor({ category: filter.category })}
            aria-current={data.category === filter.category ? 'page' : undefined}
            class={chip}
          >
            {filter.label()}
          </a>
        </li>
      {/each}
      <li>
        <a
          href={hrefFor({ unread: !data.unread })}
          aria-current={data.unread ? 'true' : undefined}
          class="{chip} aria-current:border-primary-500 aria-current:preset-filled-primary-500"
        >
          {m.notifications_filter_unread()}
        </a>
      </li>
    </ul>
  </nav>

  {#if updated.current && (data.category === null || data.category === 'system')}
    <div class="mt-6"><AppUpdateNotice /></div>
  {/if}

  {#if filtering.current}
    <ListSkeleton kind="rows" />
  {:else if data.notifications.length === 0}
    <p class="mt-8 text-lg" role="status">
      {data.unread ? m.notifications_empty_unread() : m.notifications_empty()}
    </p>
  {:else}
    <!-- One panel with a row per item; a dot marks the unread ones. -->
    <ul
      class="mt-6 divide-y divide-surface-200-800 overflow-hidden rounded-lg border border-surface-200-800 bg-panel"
    >
      {#each data.notifications as item (item.id)}
        <li class="flex items-start gap-3 p-4">
          <span
            aria-hidden="true"
            class="mt-2 size-2 shrink-0 rounded-full {item.read ? '' : 'bg-primary-500'}"
          ></span>
          <NotificationIcon
            icon={notificationIcon(item)}
            size={22}
            class="mt-1 {isAlert(item) ? 'text-error-700-300' : 'text-muted'}"
          />
          <div class="min-w-0 flex-1">
            {#if item.link}
              <NotificationAction
                action="open"
                id={item.id}
                next={here}
                buttonClass="text-left link-underline {item.read ? 'font-normal' : ''}"
              >
                {notificationText(item, shownTimezone('America/Sao_Paulo'))}
              </NotificationAction>
            {:else}
              <p class={item.read ? '' : 'font-semibold'}>
                {notificationText(item, shownTimezone('America/Sao_Paulo'))}
              </p>
            {/if}
            <p class="mt-1 text-sm text-muted">{when(item.createdAt)}</p>
          </div>
          {#if !item.read}
            <NotificationAction
              action="read"
              id={item.id}
              next={here}
              class="m-0 shrink-0"
              buttonClass="btn h-11 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
            >
              {m.notifications_mark_read()}
            </NotificationAction>
          {/if}
        </li>
      {/each}
    </ul>
    {#if data.pages > 1}
      <nav
        aria-label={m.notifications_pagination_label()}
        class="mt-6 flex flex-wrap items-center justify-between gap-2"
      >
        {#if data.page > 1}
          <a href={hrefFor({ page: data.page - 1 })} class={pageLink}
            >{m.notifications_page_previous()}</a
          >
        {:else}
          <span></span>
        {/if}
        <span class="text-sm text-muted"
          >{m.messages_page_status({ page: data.page, pages: data.pages })}</span
        >
        {#if data.page < data.pages}
          <a href={hrefFor({ page: data.page + 1 })} class={pageLink}
            >{m.notifications_page_next()}</a
          >
        {:else}
          <span></span>
        {/if}
      </nav>
    {/if}
  {/if}
</section>
