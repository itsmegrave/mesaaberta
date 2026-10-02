<script lang="ts">
  import Form from '$lib/components/Form.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let {
    name,
    username,
    avatarUrl,
    messagesUnread = 0,
    placement = 'bottom-end',
    compact = false,
  }: {
    name: string;
    username?: string | null;
    avatarUrl: string | null;
    /** Conversations with something unread. */
    messagesUnread?: number;
    /** Where the menu opens: under the header's button, beside the side rail's, above the open side nav's. */
    placement?: 'bottom-end' | 'right-end' | 'top-start';
    /** Only the avatar, for the side rail. */
    compact?: boolean;
  } = $props();

  const locale = getLocale();
  // Signing out is a plain POST to an endpoint (not a form action), so the page itself goes away;
  // until it does, a second click is ignored. Coming back through the history resets it.
  let signingOut = $state(false);
  const item =
    'btn hover:preset-tonal flex h-12 w-full items-center justify-start gap-3 rounded-lg px-3 text-left text-base font-semibold';
</script>

<svelte:window onpageshow={() => (signingOut = false)} />

<div class="flex min-w-0 items-center gap-2">
  {#if !compact}
    <UserLink
      {username}
      label={name}
      class="hidden min-w-0 truncate text-sm font-semibold md:inline"
    />
  {/if}
  <Popover positioning={{ placement, offset: { mainAxis: 8 } }}>
    <Popover.Trigger
      aria-label="{m.nav_account_menu()}: {name}"
      class="btn flex size-11 items-center justify-center rounded-full border border-surface-200-800 bg-panel p-0 font-semibold hover:preset-tonal {compact
        ? ''
        : 'md:h-12 md:w-auto md:gap-2 md:rounded-lg md:px-1'}"
    >
      <Avatar src={avatarUrl} {name} size={32} />
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
        class="hidden shrink-0 {compact ? '' : 'md:block'}"
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
              <a href={localizedHref(`/u/${username}`, locale)} class={item}>
                <Icon name="game-icons:meeple" size={20} />
                {m.nav_view_profile()}
              </a>
            {/if}
            <a href={localizedHref('/account/profile', locale)} class={item}>
              <Icon name="square-pen" size={20} />
              {m.nav_edit_profile()}
            </a>

            <a
              href={localizedHref('/messages', locale)}
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
