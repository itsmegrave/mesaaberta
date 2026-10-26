<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import CountBadge from '#lib/components/ui/CountBadge.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import { Popover, Portal } from '@skeletonlabs/skeleton-svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ThemeToggle from '#lib/components/shell/ThemeToggle.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let {
    name,
    username,
    avatarUrl,
    messagesUnread = 0,
    isAdmin = false,
    adminPending = 0,
    placement = 'bottom-end',
    compact = false,
    wide = false,
    sheet = false,
  }: {
    name: string;
    username?: string | null;
    avatarUrl: string | null;
    /** Conversations with something unread. */
    messagesUnread?: number;
    /** Admins find the admin area here, not in the nav. */
    isAdmin?: boolean;
    /** Suggestions waiting for an admin, on the Admin item and in the button's count. */
    adminPending?: number;
    /** Where the menu opens: under the header's button, beside the side rail's, above the open side nav's. */
    placement?: 'bottom-end' | 'right-end' | 'top-start';
    /** Only the avatar, for the side rail. */
    compact?: boolean;
    /** One full-width button holding the avatar, the name and the handle, for the open side nav. */
    wide?: boolean;
    /** A bottom sheet instead of a popover, for the phone's header. */
    sheet?: boolean;
  } = $props();

  // Signing out is a plain POST to an endpoint (not a form action), so the page itself goes away;
  // until it does, a second click is ignored. Coming back through the history resets it.
  let signingOut = $state(false);
  // The desktop popover and the phone sheet can both be on the page; each labels its own theme control.
  const uid = $props.id();
  let sheetOpen = $state(false);
  let popoverOpen = $state(false);
  // Following a link closes the menu (the layout stays mounted, so it would stay open over the
  // next page); picking a theme does not, so the change shows with the menu still there.
  const close = () => {
    sheetOpen = false;
    popoverOpen = false;
  };
  const pending = $derived(isAdmin ? adminPending : 0);
  // The button carries one count: unread conversations plus what waits in the admin area.
  const total = $derived(messagesUnread + pending);
  const unreadLabel = $derived(
    (messagesUnread > 0 ? `, ${m.account_menu_unread({ count: messagesUnread })}` : '') +
      (pending > 0 ? `, ${m.nav_admin()}: ${pending}` : ''),
  );
  const triggerLabel = $derived(`${m.nav_account_menu()}: ${name}${unreadLabel}`);
  const item =
    'btn hover:preset-tonal flex h-12 w-full items-center justify-start gap-3 rounded-lg px-3 text-left text-base font-semibold';
</script>

<svelte:window onpageshow={() => (signingOut = false)} />

{#snippet avatarButton()}
  <MAAvatar src={avatarUrl} {name} size={wide ? 36 : 32} />
  {#if wide}
    <!-- The button's accessible name already carries them. -->
    <span aria-hidden="true" class="min-w-0 flex-1 text-left">
      <span class="block truncate">{name}</span>
      {#if username}
        <span class="block truncate text-xs font-normal text-muted">@{username}</span>
      {/if}
    </span>
  {/if}
  <CountBadge
    count={total}
    aria-hidden="true"
    class={wide ? 'h-5.5 min-w-5.5 px-1.5' : 'absolute top-0 right-0 h-4 min-w-4 px-1'}
  />
{/snippet}

<!-- Perfil, Mensagens, Admin (admins), Tema and Sair: the same list in the popover and the sheet. -->
{#snippet menu()}
  <nav aria-label={m.nav_account_menu()} class="flex flex-col gap-1">
    {#if username}
      <a href={`/u/${username}`} class={item} onclick={close}>
        <Icon name="game-icons:meeple" size={20} />
        {m.nav_view_profile()}
      </a>
    {/if}

    <a
      href="/m"
      class={item}
      onclick={close}
      aria-label={messagesUnread > 0
        ? m.messages_menu_unread({ count: messagesUnread })
        : undefined}
    >
      <Icon name="game-icons:scroll-quill" size={20} />
      {m.messages_menu()}
      <CountBadge
        count={messagesUnread}
        data-testid="messages-count"
        aria-hidden="true"
        class="ml-auto min-w-6 px-1"
      />
    </a>

    {#if isAdmin}
      <a
        href="/admin"
        class={item}
        onclick={close}
        aria-label={pending > 0 ? `${m.nav_admin()}: ${pending}` : undefined}
      >
        <Icon name="game-icons:black-knight-helm" size={20} />
        {m.nav_admin()}
        <CountBadge
          count={pending}
          data-testid="admin-count"
          aria-hidden="true"
          class="ml-auto min-w-6 px-1"
        />
      </a>
    {/if}

    <div role="separator" class="my-1 h-px bg-surface-200-800"></div>
    <div class="flex min-h-12 items-center justify-between gap-3 pr-1 pl-3">
      <span id="{uid}-theme" class="text-base font-semibold">{m.theme_label()}</span>
      <ThemeToggle segmented labelledby="{uid}-theme" />
    </div>
    <div role="separator" class="my-1 h-px bg-surface-200-800"></div>

    <MAForm method="POST" action="/logout" class="m-0" onsubmit={() => (signingOut = true)}>
      <MAButton type="submit" size="custom" submitting={signingOut} class={item}>
        <Icon name="game-icons:exit-door" size={20} />
        {m.nav_sign_out()}
      </MAButton>
    </MAForm>
  </nav>
{/snippet}

{#if sheet}
  <DialogShell
    bind:open={sheetOpen}
    sheet
    title={m.nav_account_menu()}
    {triggerLabel}
    triggerClass="relative btn flex size-11 items-center justify-center rounded-full border border-surface-200-800 bg-panel p-0 font-semibold hover:preset-tonal"
  >
    {#snippet trigger()}{@render avatarButton()}{/snippet}
    <div class="mt-4">{@render menu()}</div>
  </DialogShell>
{:else}
  <div class="flex min-w-0 items-center gap-2 {wide ? 'w-full' : ''}">
    {#if !compact && !wide}
      <UserLink
        {username}
        label={name}
        class="hidden min-w-0 truncate text-sm font-semibold md:inline"
      />
    {/if}
    <Popover
      open={popoverOpen}
      onOpenChange={(details) => (popoverOpen = details.open)}
      positioning={{ placement, offset: { mainAxis: 8 } }}
    >
      <Popover.Trigger
        aria-label={triggerLabel}
        class="relative btn flex items-center border border-surface-200-800 bg-panel font-semibold hover:preset-tonal {wide
          ? 'w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 text-sm'
          : 'size-11 justify-center rounded-full p-0'} {compact || wide
          ? ''
          : 'md:h-12 md:w-auto md:gap-2 md:rounded-lg md:px-1'}"
      >
        {@render avatarButton()}
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
          class="shrink-0 text-muted {wide ? '' : compact ? 'hidden' : 'hidden md:block'}"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Popover.Trigger>

      <Portal>
        <Popover.Positioner class="z-50!">
          <Popover.Content
            class="w-72 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
          >
            {@render menu()}
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover>
  </div>
{/if}
