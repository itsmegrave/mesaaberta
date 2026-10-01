<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { invalidate } from '$app/navigation';
  import ChatHeader from '$lib/components/ChatHeader.svelte';
  import Composer from '$lib/components/Composer.svelte';
  import MessageList from '$lib/components/MessageList.svelte';
  import { apiRead } from '$lib/api/http';
  import { localizedHref } from '$lib/i18n/locales';
  import { mergeMessages, type ThreadItem } from '$lib/messages/group';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle } from '$lib/profile/handle';
  import { BADGES_KEY } from '$lib/query/badges';
  import { queryClient } from '$lib/query/context';
  import type { ChatThreadData } from '$lib/server/messages/thread';

  let {
    data,
    drawer = false,
    onback,
  }: { data: ChatThreadData; drawer?: boolean; onback?: () => void } = $props();

  const client = queryClient();
  const locale = getLocale();
  // The thread is rebuilt (this component is keyed) when another conversation opens.
  // svelte-ignore state_referenced_locally
  const conversationId = data.conversation.id;
  // svelte-ignore state_referenced_locally
  const viewerId = data.viewerId;
  type Thread = { messages: ThreadItem[]; hasMore: boolean };

  let visible = $state(true);
  let focused = $state(true);
  const syncVisibility = () => {
    visible = document.visibilityState === 'visible';
    focused = document.hasFocus();
  };

  // Polling behind one seam: swapping it for a live connection later changes only this query.
  const thread = createQuery(
    () => ({
      queryKey: ['messages', viewerId, conversationId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        apiRead<Thread>(`/api/messages/${conversationId}`, signal, viewerId),
      refetchInterval: visible && focused ? 3_000 : 15_000,
      refetchIntervalInBackground: true,
      staleTime: 0,
    }),
    () => client,
  );

  // Older pages the reader asked for, and what the poll brought, are merged by id into what loaded.
  let older = $state<ThreadItem[]>([]);
  // svelte-ignore state_referenced_locally
  let hasMore = $state(data.hasMore);
  let pending = $state<ThreadItem[]>([]);
  let sequence = 0;
  let composer: ReturnType<typeof Composer> | undefined = $state();

  const saved = $derived(
    mergeMessages(mergeMessages(data.messages, older), thread.data?.messages ?? []),
  );
  const items = $derived([...saved, ...pending]);

  // A new message from someone refreshes the inbox row and the header badges.
  // svelte-ignore state_referenced_locally
  let lastSeen = data.messages[data.messages.length - 1]?.id;
  $effect(() => {
    const latest = thread.data?.messages.at(-1)?.id;
    if (!latest || latest === lastSeen) return;
    lastSeen = latest;
    void invalidate('messages:inbox');
    void client.invalidateQueries({ queryKey: ['messages-inbox', viewerId] });
    void client.invalidateQueries({ queryKey: BADGES_KEY });
  });

  async function loadOlder() {
    const oldest = saved[0];
    if (!oldest) return;
    const page = await apiRead<Thread>(
      `/api/messages/${conversationId}?before=${encodeURIComponent(oldest.createdAt.toISOString())}`,
      undefined,
      viewerId,
    );
    older = mergeMessages(older, page.messages);
    hasMore = page.hasMore;
  }

  const onpending = (body: string) => {
    const id = `pending-${++sequence}`;
    pending.push({
      id,
      body,
      sender: null,
      avatarUrl: null,
      tableId: data.context?.id ?? null,
      tableTitle: null,
      tableSlug: null,
      createdAt: new Date(),
      own: true,
      pending: 'sending',
    });
    return id;
  };
  const onsent = async (id: string) => {
    // The bubble stays until the thread shows the real message, so nothing blinks out.
    await thread.refetch();
    pending = pending.filter((item) => item.id !== id);
    void invalidate('messages:inbox');
    void client.invalidateQueries({ queryKey: ['messages-inbox', viewerId] });
  };
  const onfailed = (id: string) => {
    pending = pending.map((item) => (item.id === id ? { ...item, pending: 'failed' } : item));
  };
  const onretry = (message: ThreadItem) => {
    pending = pending.map((item) =>
      item.id === message.id ? { ...item, pending: 'sending' } : item,
    );
    void composer?.retry(message.id, message.body);
  };

  const otherName = $derived(atHandle(data.conversation.other?.username));
</script>

<svelte:document onvisibilitychange={syncVisibility} />
<svelte:window onfocus={syncVisibility} onblur={syncVisibility} />

<section class="flex min-h-0 flex-col {drawer ? 'min-w-0 flex-1' : 'h-128 md:h-176'}">
  <ChatHeader
    conversation={data.conversation}
    {onback}
    action={drawer ? `/messages/${conversationId}?/mute` : '?/mute'}
  />

  <MessageList
    {items}
    kind={data.conversation.kind}
    otherLastReadAt={data.conversation.other?.lastReadAt ?? null}
    {hasMore}
    onloadolder={loadOlder}
    {onretry}
  />

  {#if data.conversation.canSend}
    {#if data.context}
      <p class="pb-2 text-sm">
        <a
          href={localizedHref(`/tables/${data.context.slug}`, locale)}
          class="chip h-8 rounded-lg bg-surface-wash px-3 font-semibold"
        >
          {m.messages_about_table({ table: data.context.title })}
        </a>
      </p>
    {/if}
    <Composer
      bind:this={composer}
      form={data.form}
      action={drawer ? `/messages/${conversationId}?/send` : '?/send'}
      {onpending}
      {onsent}
      {onfailed}
    />
  {:else}
    <p role="status" class="border-t border-surface-200-800 pt-3 text-muted">
      {data.conversation.kind === 'direct'
        ? m.messages_dm_off_notice({ name: otherName })
        : m.messages_read_only_table()}
    </p>
  {/if}
</section>
