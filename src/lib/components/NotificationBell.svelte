<script lang="ts">
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import { page } from '$app/state';
  import NotificationAction from '$lib/components/NotificationAction.svelte';
  import NotificationIcon from '$lib/components/NotificationIcon.svelte';
  import { notificationIcon, notificationText, type Shown } from '$lib/notifications/text';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { shownTimezone } from '$lib/time/shown-timezone';

  type Item = Shown & { id: string; read: boolean; createdAt: Date };

  let {
    unread,
    latest,
    placement = 'bottom-end',
  }: {
    unread: number;
    latest: Item[];
    /** Where the list opens: under the header's bell, beside the side rail's. */
    placement?: 'bottom-end' | 'right-end';
  } = $props();

  // Skeleton keeps a closed popover's content in the page, only hidden. The list is drawn while the
  // menu is open, so its text never doubles what the page itself says.
  let open = $state(false);

  const locale = getLocale();
  const feed = localizedHref('/notifications', locale);
  // Every form comes back to the page it was sent from.
  const here = $derived(page.url.pathname + page.url.search);
  const when = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: shownTimezone('America/Sao_Paulo'),
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  const label = $derived(
    unread > 0 ? m.notifications_bell_unread({ count: unread }) : m.notifications_bell(),
  );
</script>

<Popover
  positioning={{ placement, offset: { mainAxis: 8 } }}
  onOpenChange={(details) => (open = details.open)}
>
  <Popover.Trigger
    aria-label={label}
    class="relative btn flex size-11 items-center justify-center rounded-full p-0 hover:preset-tonal"
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
    {#if unread > 0}
      <span
        data-testid="notification-count"
        aria-hidden="true"
        class="absolute top-1 right-1 badge h-5 min-w-5 rounded-full preset-filled-error-500 px-1 text-xs font-bold"
      >
        {unread > 9 ? '9+' : unread}
      </span>
    {/if}
  </Popover.Trigger>

  <Portal>
    <Popover.Positioner class="z-50!">
      <Popover.Content
        class="w-80 max-w-screen card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
      >
        <div class="flex items-center justify-between gap-2 p-2">
          <Popover.Title class="text-base font-bold">{m.notifications_title()}</Popover.Title>
          {#if unread > 0}
            <NotificationAction
              action="readAll"
              next={here}
              buttonClass="btn h-9 rounded-lg px-2 text-sm font-semibold text-link"
            >
              {m.notifications_mark_all()}
            </NotificationAction>
          {/if}
        </div>

        {#if !open}
          <!-- Nothing until the menu opens. -->
        {:else if latest.length === 0}
          <p class="p-2 pb-3 text-sm text-muted">{m.notifications_empty()}</p>
        {:else}
          <ul class="flex flex-col gap-1">
            {#each latest as item (item.id)}
              <li>
                <NotificationAction
                  action="open"
                  id={item.id}
                  next={here}
                  buttonClass="btn flex h-auto w-full items-start justify-start gap-3 rounded-lg p-2 text-left font-normal whitespace-normal hover:preset-tonal"
                >
                  <NotificationIcon icon={notificationIcon(item)} class="mt-1 text-muted" />
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm {item.read ? '' : 'font-semibold'}"
                      >{notificationText(item)}</span
                    >
                    <span class="block text-xs text-muted">{when(item.createdAt)}</span>
                  </span>
                  {#if !item.read}
                    <span class="mt-2 size-2 shrink-0 rounded-full bg-primary-500">
                      <span class="sr-only">{m.notifications_unread()}</span>
                    </span>
                  {/if}
                </NotificationAction>
              </li>
            {/each}
          </ul>
        {/if}

        <hr class="mx-2 my-1" />
        <a
          href={feed}
          class="btn flex h-12 w-full items-center justify-center rounded-lg font-semibold hover:preset-tonal"
        >
          {m.notifications_see_all()}
        </a>
      </Popover.Content>
    </Popover.Positioner>
  </Portal>
</Popover>
