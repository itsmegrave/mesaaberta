<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { tick } from 'svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import MessageBubble from '$lib/components/MessageBubble.svelte';
  import { clock, dayLabel } from '$lib/messages/format';
  import { groupMessages, type ThreadItem } from '$lib/messages/group';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle } from '$lib/profile/handle';
  import { shownTimezone } from '$lib/time/shown-timezone';

  let {
    items,
    kind,
    otherLastReadAt = null,
    hasMore = false,
    onloadolder,
    onretry,
  }: {
    items: ThreadItem[];
    kind: 'table' | 'direct';
    /** When the other person last read a direct conversation. */
    otherLastReadAt?: Date | null;
    hasMore?: boolean;
    /** Loads the messages before the first one shown. */
    onloadolder?: () => Promise<void>;
    onretry?: (message: ThreadItem) => void;
  } = $props();

  const locale = getLocale();
  const zone = $derived(shownTimezone('America/Sao_Paulo'));
  const now = new Date();
  const blocks = $derived(groupMessages(items, zone));
  const name = (sender: string | null) => (sender ? atHandle(sender) : m.messages_deleted_user());

  // "Visto" goes under the last message of mine that was sent, in a direct conversation.
  const seenId = $derived.by(() => {
    if (kind !== 'direct' || !otherLastReadAt) return null;
    const mine = items.filter((item) => item.own && !item.pending);
    const last = mine[mine.length - 1];
    return last && otherLastReadAt.getTime() >= last.createdAt.getTime() ? last.id : null;
  });

  let scroller: HTMLElement | undefined = $state();
  let stuck = true;
  let loadingOlder = $state(false);

  const onscroll = () => {
    if (scroller) stuck = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 96;
  };

  // Opens at the bottom, and follows the newest message while the reader is there (or sent it).
  const newest = $derived(items[items.length - 1]);
  $effect(() => {
    if (!newest) return;
    if (newest.own) stuck = true;
    void tick().then(() => {
      if (stuck && scroller) scroller.scrollTop = scroller.scrollHeight;
    });
  });

  async function older() {
    if (!scroller || !onloadolder || loadingOlder) return;
    loadingOlder = true;
    const before = scroller.scrollHeight;
    try {
      await onloadolder();
      await tick();
      stuck = false;
      // Keep the message the reader was looking at where it was.
      scroller.scrollTop += scroller.scrollHeight - before;
    } finally {
      loadingOlder = false;
    }
  }
</script>

<div
  bind:this={scroller}
  {onscroll}
  role="log"
  aria-live="polite"
  aria-label={m.messages_thread_label()}
  class="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto py-3"
>
  {#if hasMore}
    <Button
      size="custom"
      type="button"
      onclick={older}
      aria-disabled={loadingOlder || undefined}
      class="mx-auto mb-2 btn h-12 rounded-lg border-2 border-surface-200-800 px-4 text-sm font-semibold hover:preset-tonal"
    >
      {loadingOlder ? m.nav_loading() : m.messages_load_older()}
    </Button>
  {/if}

  {#if items.length === 0}
    <p class="m-auto text-muted">{m.messages_no_messages()}</p>
  {/if}

  {#each blocks as block (block.day)}
    <p class="my-3 text-center text-xs font-semibold text-muted">
      {dayLabel(block.date, now, locale, zone)}
    </p>
    {#each block.groups as group (group.key)}
      {@const last = group.messages[group.messages.length - 1]}
      <div class="flex items-end gap-2 {group.own ? 'justify-end' : ''}">
        {#if !group.own}
          <span class="w-8 shrink-0">
            <Avatar src={group.avatarUrl} name={group.sender} size={32} />
          </span>
        {/if}
        <div
          class="flex max-w-4/5 min-w-0 flex-col gap-1 {group.own ? 'items-end' : 'items-start'}"
        >
          {#if !group.own && kind === 'table'}
            <p class="max-w-full truncate px-1 text-xs font-semibold text-muted">
              <UserLink username={group.sender} label={name(group.sender)} />
            </p>
          {/if}
          {#each group.messages as message (message.id)}
            <div class="flex flex-col {group.own ? 'items-end' : 'items-start'}">
              <MessageBubble {message} {onretry} />
            </div>
          {/each}
          <p class="px-1 text-xs text-muted">
            <time datetime={last.createdAt.toISOString()}
              >{clock(last.createdAt, locale, zone)}</time
            >{#if seenId === last.id}
              · {m.messages_seen()}{/if}
          </p>
        </div>
      </div>
    {/each}
  {/each}
</div>
