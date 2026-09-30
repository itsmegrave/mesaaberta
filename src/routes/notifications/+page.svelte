<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { navigating, page } from '$app/state';
  import ListSkeleton from '$lib/components/ListSkeleton.svelte';
  import { Slow } from '$lib/navigation/slow.svelte';
  import NotificationAction from '$lib/components/NotificationAction.svelte';
  import NotificationIcon from '$lib/components/NotificationIcon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import type { NotificationCategory } from '$lib/notifications/kinds';
  import { notificationIcon, notificationText } from '$lib/notifications/text';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { shownTimezone } from '$lib/time/shown-timezone';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while. Coming back to the same query (after marking read, say) keeps the list.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const locale = getLocale();
  const feed = localizedHref('/notifications', locale);
  // Every form comes back to the filter it was sent from.
  const here = $derived(data.category ? `${feed}?category=${data.category}` : feed);

  // Only the categories that have events today; catalog, moderation and announcements join the
  // filters with the slices that write them.
  const filters: { category: NotificationCategory | null; label: () => string }[] = [
    { category: null, label: m.notifications_filter_all },
    { category: 'table', label: m.notifications_filter_table },
    { category: 'registration', label: m.notifications_filter_registration },
    { category: 'rating', label: m.notifications_filter_rating },
  ];

  const unread = $derived(data.notifications.some((item) => !item.read));
  const when = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: shownTimezone('America/Sao_Paulo'),
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);

  const chip =
    'btn h-12 shrink-0 rounded-lg border-2 border-surface-200-800 px-4 text-sm font-semibold hover:preset-tonal aria-[current=page]:border-primary-500 aria-[current=page]:preset-tonal-primary';
</script>

<svelte:head>
  <title>{m.notifications_title()}</title>
</svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs class="mb-8" items={[{ label: m.notifications_title() }]} />
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
        {m.notifications_title()}
      </h1>
      <p class="mt-2 max-w-md text-base text-muted md:mt-3 md:text-xl">
        {m.notifications_lede()}
      </p>
    </div>
    {#if unread}
      <NotificationAction
        action="readAll"
        next={here}
        buttonClass="btn h-12 rounded-lg border-2 border-primary-500 px-6 font-semibold"
      >
        {m.notifications_mark_all()}
      </NotificationAction>
    {/if}
  </div>

  <nav
    aria-label={m.notifications_filter_label()}
    class="-mx-5 mt-8 overflow-x-auto px-5 md:mx-0 md:px-0"
  >
    <ul class="flex gap-2">
      {#each filters as filter (filter.category)}
        <li>
          <a
            href={localizedHref(
              filter.category ? `/notifications?category=${filter.category}` : '/notifications',
              locale,
            )}
            aria-current={data.category === filter.category ? 'page' : undefined}
            class={chip}
          >
            {filter.label()}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  {#if filtering.current}
    <ListSkeleton kind="rows" />
  {:else if data.notifications.length === 0}
    <p class="mt-8 text-lg" role="status">{m.notifications_empty()}</p>
  {:else}
    <ul class="mt-6 grid gap-2">
      {#each data.notifications as item (item.id)}
        <li
          class="flex items-start gap-3 rounded-lg border border-surface-200-800 p-4 {item.read
            ? ''
            : 'bg-panel'}"
        >
          <NotificationIcon icon={notificationIcon(item)} size={22} class="mt-1 text-muted" />
          <div class="min-w-0 flex-1">
            {#if item.link}
              <NotificationAction
                action="open"
                id={item.id}
                next={here}
                buttonClass="text-left link-underline {item.read ? 'font-normal' : ''}"
              >
                {notificationText(item)}
              </NotificationAction>
            {:else}
              <p class={item.read ? '' : 'font-semibold'}>{notificationText(item)}</p>
            {/if}
            <p class="mt-1 text-sm text-muted">{when(item.createdAt)}</p>
          </div>
          {#if !item.read}
            <NotificationAction
              action="read"
              id={item.id}
              next={here}
              class="m-0 shrink-0"
              buttonClass="btn h-12 rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
            >
              {m.notifications_mark_read()}
            </NotificationAction>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>
