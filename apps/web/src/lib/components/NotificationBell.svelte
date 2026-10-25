<script lang="ts">
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import { page } from '$app/state';
  import Icon from '#lib/components/Icon.svelte';
  import NotificationAction from '#lib/components/NotificationAction.svelte';
  import NotificationIcon from '#lib/components/NotificationIcon.svelte';
  import { notificationIcon, notificationText, type Shown } from '#lib/notifications/text.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';

  type Item = Shown & { id: string; read: boolean; createdAt: Date };

  let {
    unread,
    latest,
    placement = 'bottom-end',
    labelled = false,
  }: {
    unread: number;
    latest: Item[];
    /** Where the list opens: under the header's bell, beside the side rail's. */
    placement?: 'bottom-end' | 'right-end';
    /** A full-width row with the word "Notificações" and the count, for the open side nav. */
    labelled?: boolean;
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
    unread > 0 ? m.notifications_bell_unread({ count: unread }) : m.notifications_bell(),
  );
</script>

<Popover
  positioning={{ placement, offset: { mainAxis: 8 } }}
  onOpenChange={(details) => (open = details.open)}
>
  <Popover.Trigger
    aria-label={label}
    class="relative btn flex items-center {labelled
      ? 'h-11 w-full justify-start gap-3 rounded-lg px-3 text-sm hover:bg-surface-200-800'
      : 'size-11 justify-center rounded-full border border-surface-200-800 bg-panel p-0 hover:preset-tonal'}"
  >
    <span class="flex shrink-0 {labelled ? 'text-muted' : ''}">
      <Icon name="bell" size={20} />
    </span>
    {#if labelled}<span aria-hidden="true" class="flex-1 text-left font-semibold"
        >{m.notifications_title()}</span
      >{/if}
    {#if unread > 0}
      <!-- Counts are warning, never danger: they mean "needs attention", not an error. -->
      <span
        data-testid="notification-count"
        aria-hidden="true"
        class="badge rounded-full preset-filled-warning-500 text-xs font-bold {labelled
          ? 'h-5.5 min-w-5.5 px-1.5'
          : 'absolute top-0 right-0 h-4 min-w-4 px-1'}"
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
              buttonClass="btn h-11 rounded-lg px-2 text-sm font-semibold text-link"
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
