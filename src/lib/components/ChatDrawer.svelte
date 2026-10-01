<script lang="ts">
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
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
  let selected = $state<string | null>(null);
  let inboxPage = $state(1);
  const client = queryClient();
  const locale = getLocale();
  const inbox = createQuery(
    () => ({
      queryKey: ['messages-inbox', viewerId, inboxPage],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRead<{ items: InboxItem[]; page: number; pages: number }>(
          `/api/messages/inbox?page=${inboxPage}`,
          signal,
          viewerId,
        ),
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
  const back = () => {
    selected = null;
    void inbox.refetch();
  };
</script>

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
    if (!open) selected = null;
  }}
>
  <Dialog.Trigger
    class="fixed right-4 bottom-24 z-30 btn size-14 rounded-full preset-filled-primary-500 p-0 shadow-lg md:right-6 md:bottom-6"
    aria-label={m.messages_drawer_open()}
  >
    <Icon name="message-circle" size={24} />
    {#if unread > 0}<span class="absolute -top-1 -right-1 badge preset-filled-error-500"
        >{unread}</span
      >{/if}
  </Dialog.Trigger>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-end">
      <Dialog.Content
        class="flex h-dvh w-full max-w-xl min-w-0 flex-col overflow-x-hidden border-l border-surface-200-800 bg-surface-50-950 p-4 shadow-2xl md:p-6"
      >
        <div class="mb-4 flex shrink-0 items-center justify-between gap-2">
          <Dialog.Title class="min-w-0 flex-1 truncate text-xl font-semibold"
            >{m.messages_title()}</Dialog.Title
          >
          <a
            href={localizedHref(selected ? `/messages/${selected}` : '/messages', locale)}
            class="btn h-12 shrink-0 rounded-lg px-3 text-sm hover:preset-tonal"
            aria-label={m.messages_full_page()}
            ><Icon name="external-link" size={20} /><span class="hidden sm:inline"
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
              <button class="btn preset-tonal" onclick={() => thread.refetch()}
                >{m.messages_retry_load()}</button
              >
              <button class="btn preset-tonal" onclick={back}>{m.messages_back()}</button>
            {:else if thread.data}
              {#key selected}<ChatThread data={thread.data} drawer onback={back} />{/key}
            {:else}<p role="status">{m.nav_loading()}</p>{/if}
          {:else if inbox.isError}
            <p role="alert">{m.messages_error_generic()}</p>
            <button class="btn preset-tonal" onclick={() => inbox.refetch()}
              >{m.messages_retry_load()}</button
            >
          {:else if inbox.data}
            <div class="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
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
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
