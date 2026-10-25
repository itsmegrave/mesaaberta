<script lang="ts">
  import CountBadge from '#lib/components/ui/CountBadge.svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import { page, updated } from '$app/state';
  import AppUpdateNotice from './AppUpdateNotice.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import NotificationAction from '#lib/components/NotificationAction.svelte';
  import NotificationIcon from '#lib/components/ui/NotificationIcon.svelte';
  import { notificationIcon, notificationText, type Shown } from '#lib/notifications/text.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';

  type Item = Shown & { id: string; read: boolean; createdAt: Date };

  let {
    unread,
    latest,
    seenAt,
    placement = 'bottom-end',
    labelled = false,
    rail = false,
  }: {
    unread: number;
    latest: Item[];
    /** When `latest` was read, so "mark all read" leaves what arrived after it. */
    seenAt?: string;
    /** Where the list opens: under the header's bell, beside the side rail's. */
    placement?: 'bottom-end' | 'right-end';
    /** A full-width row with the word "Notificações" and the count, for the open side nav. */
    labelled?: boolean;
    /** The collapsed side nav's item: the bell on a 40px tile over a short label. */
    rail?: boolean;
  } = $props();

  // Skeleton keeps a closed popover's content in the page, only hidden. The list is drawn while the
  // menu is open, so its text never doubles what the page itself says.
  let open = $state(false);

  const locale = getLocale();
  const feed = '/n';
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
    unread > 0
      ? m.notifications_bell_unread({ count: unread })
      : updated.current
        ? m.notifications_bell_update()
        : m.notifications_bell(),
  );
</script>

<Popover
  positioning={{ placement, offset: { mainAxis: 8 } }}
  onOpenChange={(details) => (open = details.open)}
>
  <Popover.Trigger
    aria-label={label}
    class="relative btn flex items-center {rail
      ? 'group min-h-14 w-16 flex-col justify-center gap-1 bg-transparent p-1 text-xs leading-tight whitespace-normal text-muted hover:bg-transparent hover:text-surface-950-50'
      : labelled
        ? 'h-11 w-full justify-start gap-3 rounded-lg px-3 text-sm hover:bg-surface-200-800'
        : 'size-11 justify-center rounded-full border border-surface-200-800 bg-panel p-0 hover:preset-tonal'}"
  >
    <span
      class="flex shrink-0 {rail
        ? 'size-10 items-center justify-center rounded-lg group-hover:bg-surface-200-800'
        : labelled
          ? 'text-muted'
          : ''}"
    >
      <Icon name="bell" size={20} />
    </span>
    {#if labelled}<span aria-hidden="true" class="flex-1 text-left font-semibold"
        >{m.notifications_title()}</span
      >{:else if rail}<span aria-hidden="true" class="w-full min-w-0 font-semibold"
        >{m.nav_notifications_rail()}</span
      >{/if}
    {#if unread > 0}
      <!-- Counts are warning, never danger: they mean "needs attention", not an error. -->
      <CountBadge
        count={unread}
        data-testid="notification-count"
        aria-hidden="true"
        class={labelled
          ? 'h-5.5 min-w-5.5 px-1.5'
          : rail
            ? 'absolute top-0.5 right-2 h-4 min-w-4 px-1'
            : 'absolute top-0 right-0 h-4 min-w-4 px-1'}
      />
    {:else if updated.current}
      <!-- A new version is not an unread notification: a dot, not a count. -->
      <span
        data-testid="app-update-dot"
        aria-hidden="true"
        class="size-2.5 rounded-full bg-primary-500 {labelled ? '' : 'absolute top-0.5 right-0.5'}"
      ></span>
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
              until={seenAt}
              buttonClass="btn h-11 rounded-lg px-2 text-sm font-semibold text-link"
            >
              {m.notifications_mark_all()}
            </NotificationAction>
          {/if}
        </div>

        {#if open && updated.current}
          <div class="mb-1"><AppUpdateNotice compact /></div>
        {/if}
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
                      >{notificationText(item, shownTimezone('America/Sao_Paulo'))}</span
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
