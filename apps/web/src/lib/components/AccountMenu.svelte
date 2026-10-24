<script lang="ts">
  import Form from '#lib/components/Form.svelte';
  import UserLink from '#lib/components/UserLink.svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import Avatar from '#lib/components/Avatar.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import SubmitButton from '#lib/components/SubmitButton.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    name,
    username,
    avatarUrl,
    messagesUnread = 0,
    isAdmin = false,
    pendingSuggestionsCount = 0,
    placement = 'bottom-end',
    compact = false,
    wide = false,
  }: {
    name: string;
    username?: string | null;
    avatarUrl: string | null;
    /** Conversations with something unread. */
    messagesUnread?: number;
    /** Adds the admin link: the phone's header has no room for it in the tab bar. */
    isAdmin?: boolean;
    /** Suggestions waiting for an admin, shown on the admin link. */
    pendingSuggestionsCount?: number;
    /** Where the menu opens: under the header's button, beside the side rail's, above the open side nav's. */
    placement?: 'bottom-end' | 'right-end' | 'top-start';
    /** Only the avatar, for the side rail. */
    compact?: boolean;
    /** One full-width button holding the avatar and the name, for the open side nav. */
    wide?: boolean;
  } = $props();

  // Signing out is a plain POST to an endpoint (not a form action), so the page itself goes away;
  // until it does, a second click is ignored. Coming back through the history resets it.
  let signingOut = $state(false);
  const item =
    'btn hover:preset-tonal flex h-12 w-full items-center justify-start gap-3 rounded-lg px-3 text-left text-base font-semibold';
</script>

<svelte:window onpageshow={() => (signingOut = false)} />

<div class="flex min-w-0 items-center gap-2 {wide ? 'w-full' : ''}">
  {#if !compact && !wide}
    <UserLink
      {username}
      label={name}
      class="hidden min-w-0 truncate text-sm font-semibold md:inline"
    />
  {/if}
  <Popover positioning={{ placement, offset: { mainAxis: 8 } }}>
    <Popover.Trigger
      aria-label="{m.nav_account_menu()}: {name}"
      class="btn flex items-center border border-surface-200-800 bg-panel font-semibold hover:preset-tonal {wide
        ? 'h-12 w-full justify-start gap-3 rounded-lg px-2 text-sm'
        : 'size-11 justify-center rounded-full p-0'} {compact || wide
        ? ''
        : 'md:h-12 md:w-auto md:gap-2 md:rounded-lg md:px-1'}"
    >
      <Avatar src={avatarUrl} {name} size={32} />
      {#if wide}
        <!-- The button's accessible name already carries it. -->
        <span aria-hidden="true" class="min-w-0 flex-1 truncate text-left">{name}</span>
      {/if}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0 {wide ? '' : compact ? 'hidden' : 'hidden md:block'}"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </Popover.Trigger>

    <Portal>
      <Popover.Positioner class="z-50!">
        <Popover.Content
          class="w-64 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
        >
          <nav aria-label={m.nav_account_menu()} class="flex flex-col gap-1">
            {#if username}
              <a href={`/u/${username}`} class={item}>
                <Icon name="game-icons:meeple" size={20} />
                {m.nav_view_profile()}
              </a>
            {/if}

            <a
              href="/m"
              class={item}
              aria-label={messagesUnread > 0
                ? m.messages_menu_unread({ count: messagesUnread })
                : undefined}
            >
              <Icon name="game-icons:scroll-quill" size={20} />
              {m.messages_menu()}
              {#if messagesUnread > 0}
                <span
                  data-testid="messages-count"
                  aria-hidden="true"
                  class="ml-auto badge min-w-6 rounded-full preset-filled-error-500 px-1 font-bold"
                >
                  {messagesUnread > 9 ? '9+' : messagesUnread}
                </span>
              {/if}
            </a>

            {#if isAdmin}
              <a
                href="/admin"
                class={item}
                aria-label={pendingSuggestionsCount > 0
                  ? `${m.nav_admin()}: ${pendingSuggestionsCount}`
                  : undefined}
              >
                <Icon name="shield" size={20} />
                {m.nav_admin()}
                {#if pendingSuggestionsCount > 0}
                  <span
                    aria-hidden="true"
                    class="ml-auto badge min-w-6 rounded-full preset-filled-warning-500 px-1 text-xs font-bold"
                  >
                    {pendingSuggestionsCount > 9 ? '9+' : pendingSuggestionsCount}
                  </span>
                {/if}
              </a>
            {/if}

            <Form method="POST" action="/logout" class="m-0" onsubmit={() => (signingOut = true)}>
              <SubmitButton submitting={signingOut} class={item}>
                <Icon name="game-icons:exit-door" size={20} />
                {m.nav_sign_out()}
              </SubmitButton>
            </Form>
          </nav>
        </Popover.Content>
      </Popover.Positioner>
    </Portal>
  </Popover>
</div>
