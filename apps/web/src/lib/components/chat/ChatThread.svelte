<script lang="ts">
  import UserText from '#lib/components/ui/UserText.svelte';
  import { createQuery } from '@tanstack/svelte-query';
  import { invalidate } from '$app/navigation';
  import ChatHeader from '#lib/components/chat/ChatHeader.svelte';
  import Composer from '#lib/components/chat/Composer.svelte';
  import MessageList from '#lib/components/chat/ui/MessageList.svelte';
  import { apiRead } from '#lib/api/http.js';
  import { mergeMessages, type ThreadItem } from '#lib/messages/group.js';
  import { m } from '#lib/paraglide/messages.js';

  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { TABLE_CHAT_DAYS_AFTER_END } from '@mesaaberta/core/messages/schema';
  import { BADGES_KEY } from '#lib/query/badges.js';
  import { queryClient } from '#lib/query/context.js';
  import type { ChatThreadData } from '#lib/server/messages/thread.js';

  let {
    data,
    drawer = false,
    onback,
  }: { data: ChatThreadData; drawer?: boolean; onback?: () => void } = $props();

  const client = queryClient();
  // The thread is rebuilt (this component is keyed) when another conversation opens.
  // svelte-ignore state_referenced_locally
  const conversationId = data.conversation.id;
  // svelte-ignore state_referenced_locally
  const viewerId = data.viewerId;
  type Thread = { messages: ThreadItem[]; hasMore: boolean; otherLastReadAt?: Date | null };

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

  // Seen: while the thread is in front, the newest message from someone else counts as read. The
  // page load already marked what it showed; a poll in the background marks nothing.
  // svelte-ignore state_referenced_locally
  let lastMarked = data.messages.at(-1)?.id;
  $effect(() => {
    const latest = thread.data?.messages.at(-1);
    if (!visible || !focused || !latest || latest.own || latest.id === lastMarked) return;
    lastMarked = latest.id;
    void fetch(`/api/messages/${conversationId}/read`, {
      method: 'POST',
      credentials: 'same-origin',
    }).then((response) => {
      if (response.ok) void client.invalidateQueries({ queryKey: BADGES_KEY });
    });
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

<!-- On a phone the page's thread takes the screen that is left: 100dvh less the header (4rem), the
     inbox column's padding (1.5rem), the page's bottom padding (2rem) and the tab bar (5rem), so the
     composer always sits above the tab bar. -->
<section
  class="flex min-h-0 flex-col {drawer
    ? 'min-w-0 flex-1'
    : 'h-[calc(100dvh-12.5rem)] min-h-80 md:h-176 md:min-h-0'}"
>
  <ChatHeader
    conversation={data.conversation}
    {onback}
    action={drawer ? `/m/${conversationId}?/mute` : '?/mute'}
  />

  <MessageList
    {items}
    kind={data.conversation.kind}
    otherLastReadAt={thread.data?.otherLastReadAt ?? data.conversation.other?.lastReadAt ?? null}
    {hasMore}
    onloadolder={loadOlder}
    {onretry}
  />

  {#if data.conversation.canSend}
    {#if data.context}
      <p class="pb-2 text-sm">
        <a
          href={`/t/${data.context.slug}`}
          class="chip h-8 rounded-lg bg-surface-wash px-3 font-semibold"
        >
          {m.messages_about_table({ table: data.context.title })}
        </a>
      </p>
    {/if}
    <Composer
      bind:this={composer}
      form={data.form}
      action={drawer ? `/m/${conversationId}?/send` : '?/send'}
      {onpending}
      {onsent}
      {onfailed}
    />
  {:else}
    <p role="status" class="border-t border-surface-200-800 pt-3 text-muted">
      {#if data.conversation.kind === 'direct'}
        <UserText
          text={m.messages_dm_off_notice({ name: otherName })}
          username={data.conversation.other?.username}
        />
      {:else if data.conversation.tableChat === 'ended'}
        {m.messages_read_only_table_ended({ days: TABLE_CHAT_DAYS_AFTER_END })}
      {:else}
        {m.messages_read_only_table()}
      {/if}
    </p>
  {/if}
</section>
