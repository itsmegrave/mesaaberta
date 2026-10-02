<script lang="ts" module>
  export type InboxItem = {
    id: string;
    kind: 'table' | 'direct';
    title: string;
    tableSlug: string | null;
    imageUrl: string | null;
    avatarUrl: string | null;
    lastMessageAt: Date;
    preview: { body: string; own: boolean; sender: string | null } | null;
    unread: number;
    muted: boolean;
  };
</script>

<script lang="ts">
  import UserText from '$lib/components/UserText.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { shortTime } from '$lib/messages/format';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { atHandle } from '$lib/profile/handle';
  import { shownTimezone } from '$lib/time/shown-timezone';

  let {
    items,
    page,
    pages,
    currentId = null,
    onselect,
    onpage,
  }: {
    items: InboxItem[];
    page: number;
    pages: number;
    currentId?: string | null;
    onselect?: (id: string) => void;
    onpage?: (page: number) => void;
  } = $props();

  const locale = getLocale();
  const now = new Date();
  const zone = $derived(shownTimezone('America/Sao_Paulo'));
  const name = (item: InboxItem) => (item.kind === 'direct' ? atHandle(item.title) : item.title);
  const preview = (item: InboxItem) => {
    if (!item.preview) return m.messages_no_messages();
    const body = item.preview.body.replace(/\s+/g, ' ');
    if (item.preview.own) return m.messages_preview_own({ body });
    return item.kind === 'table'
      ? m.messages_preview_other({ sender: atHandle(item.preview.sender), body })
      : body;
  };
  const pageHref = (target: number) =>
    localizedHref(target === 1 ? '/messages' : `/messages?page=${target}`, locale);
  const pageLink =
    'btn h-12 rounded-lg border-2 border-surface-200-800 px-4 text-sm font-semibold hover:preset-tonal';
</script>

{#if items.length === 0}
  <p role="status" class="p-4 text-muted">{m.messages_empty()}</p>
{:else}
  <ul aria-label={m.messages_inbox_label()} class="grid gap-1">
    {#each items as item (item.id)}
      <li
        class="relative flex items-center gap-3 rounded-lg p-3 hover:preset-tonal {item.id ===
        currentId
          ? 'preset-tonal-primary'
          : ''}"
      >
        <a
          href={localizedHref(`/messages/${item.id}`, locale)}
          onclick={(event) => {
            if (onselect && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
              event.preventDefault();
              onselect(item.id);
            }
          }}
          aria-current={item.id === currentId ? 'page' : undefined}
          aria-label={`${name(item)} ${preview(item)}${item.unread > 0 ? ` ${m.messages_unread()}` : ''}`}
          class="absolute inset-0 z-1 rounded-lg focus-visible:outline-2 focus-visible:outline-primary-500"
        ></a>
        <span class="relative shrink-0">
          <Avatar
            src={item.kind === 'table' ? item.imageUrl : item.avatarUrl}
            name={item.title}
            size={48}
          />
          {#if item.kind === 'table'}
            <span
              title={m.messages_group_badge()}
              class="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full border border-surface-200-800 bg-surface-100-900"
            >
              <Icon name="message-circle" size={12} />
              <span class="sr-only">{m.messages_group_badge()}</span>
            </span>
          {/if}
        </span>

        <span class="min-w-0 flex-1">
          <span class="flex items-baseline justify-between gap-2">
            <span class="truncate {item.unread > 0 ? 'font-bold' : 'font-semibold'}"
              >{#if item.kind === 'direct'}<UserLink username={item.title} />{:else}{name(
                  item,
                )}{/if}</span
            >
            <time datetime={item.lastMessageAt.toISOString()} class="shrink-0 text-xs text-muted">
              {shortTime(item.lastMessageAt, now, locale, zone)}
            </time>
          </span>
          <span class="flex items-center gap-2">
            <span
              class="min-w-0 flex-1 truncate text-sm {item.unread > 0
                ? 'font-semibold'
                : 'text-muted'}"
            >
              {#if item.kind === 'table' && item.preview && !item.preview.own}<UserText
                  text={preview(item)}
                  username={item.preview.sender}
                />{:else}{preview(item)}{/if}
            </span>
            {#if item.muted}
              <Icon name="bell-off" size={16} class="text-muted" />
              <span class="sr-only">{m.messages_muted()}</span>
            {/if}
            {#if item.unread > 0}
              <span aria-hidden="true" class="size-3 shrink-0 rounded-full bg-primary-500"></span>
              <span class="sr-only">{m.messages_unread()}</span>
            {/if}
          </span>
        </span>
      </li>
    {/each}
  </ul>
{/if}

{#if pages > 1}
  <nav
    aria-label={m.messages_pagination_label()}
    class="mt-4 flex flex-wrap items-center justify-between gap-2"
  >
    {#if page > 1}
      <a
        href={pageHref(page - 1)}
        onclick={(event) => {
          if (onpage && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            onpage(page - 1);
          }
        }}
        class={pageLink}>{m.messages_page_previous()}</a
      >
    {:else}
      <span></span>
    {/if}
    <span class="text-sm text-muted">{m.messages_page_status({ page, pages })}</span>
    {#if page < pages}
      <a
        href={pageHref(page + 1)}
        onclick={(event) => {
          if (onpage && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            onpage(page + 1);
          }
        }}
        class={pageLink}>{m.messages_page_next()}</a
      >
    {/if}
  </nav>
{/if}
