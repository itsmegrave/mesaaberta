<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { onMount, tick } from 'svelte';
  import { Dialog, Portal, Tabs } from '@skeletonlabs/skeleton-svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import ChatThread from './ChatThread.svelte';
  import InboxList, { type InboxItem } from './InboxList.svelte';
  import Icon from './Icon.svelte';
  import { apiRead } from '$lib/api/http';
  import { queryClient } from '$lib/query/context';
  import { localizedHref } from '$lib/i18n/locales';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';
  import type { ChatThreadData } from '$lib/server/messages/thread';
  let { viewerId, unread = 0 }: { viewerId: string; unread?: number } = $props();
  let open = $state(false);
  // Drawn only in the browser. On the server the dialog's closed positioner is a full-screen layer
  // whose `pointer-events: none` is an inline style, which the CSP blocks: without JavaScript (and
  // until the page hydrates) it would sit over the page and swallow every click.
  let mounted = $state(false);
  onMount(() => (mounted = true));
  let selected = $state<string | null>(null);
  let inboxPage = $state(1);
  const triggerId = $props.id();
  // "Diretas" and "Mesas": two lists of the same inbox, each with how many conversations have
  // something unread.
  type Kind = 'direct' | 'table';
  let tab = $state<Kind>('direct');
  let unreadByKind = $state<{ direct: number; table: number } | null>(null);
  const client = queryClient();
  const locale = getLocale();
  const inbox = createQuery(
    () => ({
      queryKey: ['messages-inbox', viewerId, tab, inboxPage],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRead<{
          items: InboxItem[];
          page: number;
          pages: number;
          unreadByKind: { direct: number; table: number };
        }>(`/api/messages/inbox?page=${inboxPage}&kind=${tab}`, signal, viewerId),
      enabled: open && !selected,
      refetchInterval: open && !selected ? 30_000 : false,
    }),
    () => client,
  );
  const thread = createQuery(
    () => ({
      queryKey: ['messages-drawer', viewerId, selected],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRead<ChatThreadData>(`/api/messages/${selected}/drawer`, signal, viewerId),
      enabled: open && !!selected,
      staleTime: 0,
    }),
    () => client,
  );
  $effect(() => {
    if (inbox.data) unreadByKind = inbox.data.unreadByKind;
  });
  // Opening the drawer lands on the tab with something to read, direct messages first.
  let landed = false;
  $effect(() => {
    if (!open) landed = false;
    else if (!landed && unreadByKind) {
      landed = true;
      if (unreadByKind.direct === 0 && unreadByKind.table > 0) changeTab('table');
    }
  });
  const changeTab = (next: Kind) => {
    tab = next;
    inboxPage = 1;
  };
  const back = () => {
    selected = null;
    void inbox.refetch();
  };
</script>

{#if mounted}
  <Dialog
    {open}
    ids={{ trigger: triggerId }}
    modal={false}
    preventScroll={false}
    closeOnInteractOutside={false}
    onOpenChange={(details) => {
      open = details.open;
      if (!open) {
        selected = null;
        // Nonmodal dialogs do not use the focus trap that normally restores the trigger.
        void tick().then(() => document.getElementById(triggerId)?.focus());
      }
    }}
  >
    <Dialog.Trigger
      class="fixed right-4 bottom-24 z-30 btn size-14 rounded-full preset-filled-primary-500 p-0 shadow-lg md:right-6 md:bottom-6"
      aria-label={unread > 0
        ? m.messages_drawer_open_unread({ count: unread })
        : m.messages_drawer_open()}
    >
      <Icon name="game-icons:scroll-quill" size={24} />
      {#if unread > 0}<span class="absolute -top-1 -right-1 badge preset-filled-error-500"
          >{unread}</span
        >{/if}
    </Dialog.Trigger>
    {#if open}<Portal>
        <Dialog.Positioner
          class="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-4 pb-24 md:p-6"
        >
          <!-- Leave room for the mobile navigation and keep the floating window inside short viewports. -->
          <Dialog.Content
            class="pointer-events-auto flex h-144 max-h-[calc(100dvh-8rem)] w-96 max-w-full min-w-0 flex-col overflow-x-hidden rounded-xl border border-surface-200-800 bg-surface-50-950 p-4 shadow-2xl md:max-h-[calc(100dvh-3rem)] md:p-4"
          >
            <div class="mb-4 flex shrink-0 items-center justify-between gap-2">
              <Dialog.Title class="min-w-0 flex-1 truncate text-xl font-semibold"
                >{m.messages_title()}</Dialog.Title
              >
              <a
                href={localizedHref(selected ? `/messages/${selected}` : '/messages', locale)}
                class="btn h-12 shrink-0 rounded-lg px-3 text-sm hover:preset-tonal"
                aria-label={m.messages_full_page()}
                ><Icon name="external-link" size={20} /><span class="sr-only"
                  >{m.messages_full_page()}</span
                ></a
              >
              <Dialog.CloseTrigger
                class="btn size-12 shrink-0 rounded-lg p-0 hover:preset-tonal"
                aria-label={m.messages_drawer_close()}
                ><Icon name="circle-x" size={24} /></Dialog.CloseTrigger
              >
            </div>
            {#if open}
              {#if selected}
                {#if thread.isError}
                  <p role="alert">{m.messages_error_generic()}</p>
                  <Button size="custom" class="btn preset-tonal" onclick={() => thread.refetch()}
                    >{m.messages_retry_load()}</Button
                  >
                  <Button size="custom" class="btn preset-tonal" onclick={back}
                    >{m.messages_title()}</Button
                  >
                {:else if thread.data}
                  {#key selected}<ChatThread data={thread.data} drawer onback={back} />{/key}
                {:else}<p role="status">{m.nav_loading()}</p>{/if}
              {:else}
                <Tabs
                  value={tab}
                  onValueChange={(details) => changeTab(details.value as Kind)}
                  class="flex min-h-0 flex-1 flex-col"
                >
                  <Tabs.List
                    aria-label={m.messages_tabs_label()}
                    class="mb-3 grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-surface-950-50/5 p-1"
                  >
                    {#each [['direct', m.messages_tab_direct(), m.messages_tab_direct_unread], ['table', m.messages_tab_tables(), m.messages_tab_tables_unread]] as const as [value, label, withCount] (value)}
                      {@const count = unreadByKind?.[value] ?? 0}
                      <Tabs.Trigger
                        {value}
                        aria-label={count > 0 ? withCount({ count }) : undefined}
                        class="btn h-12 gap-2 rounded-lg font-semibold aria-selected:preset-filled-primary-500"
                      >
                        {label}
                        {#if count > 0}
                          <span
                            aria-hidden="true"
                            class="badge min-w-6 rounded-full preset-filled-error-500 px-1 text-xs font-bold"
                            >{count > 9 ? '9+' : count}</span
                          >
                        {/if}
                      </Tabs.Trigger>
                    {/each}
                  </Tabs.List>
                  {#each ['direct', 'table'] as const as value (value)}
                    <Tabs.Content {value} class="min-h-0 min-w-0 flex-1">
                      {#if tab === value}
                        {#if inbox.isError}
                          <p role="alert">{m.messages_error_generic()}</p>
                          <Button
                            size="custom"
                            class="btn preset-tonal"
                            onclick={() => inbox.refetch()}>{m.messages_retry_load()}</Button
                          >
                        {:else if inbox.data}
                          <div class="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
                            <InboxList
                              items={inbox.data.items}
                              page={inbox.data.page}
                              pages={inbox.data.pages}
                              onselect={(id) => (selected = id)}
                              onpage={(page) => (inboxPage = page)}
                            />
                          </div>
                        {:else}<p role="status">{m.nav_loading()}</p>{/if}
                      {/if}
                    </Tabs.Content>
                  {/each}
                </Tabs>
              {/if}
            {/if}
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>{/if}
  </Dialog>
{/if}
