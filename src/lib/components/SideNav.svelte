<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import AccountMenu from '$lib/components/AccountMenu.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import NotificationBell from '$lib/components/NotificationBell.svelte';
  import TableLogo from '$lib/components/TableLogo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import type { IconName } from '$lib/icons/names';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  type Account = {
    displayName: string;
    username?: string | null;
    avatarUrl: string | null;
    isAdmin: boolean;
    pendingSuggestionsCount: number;
  };

  let {
    account,
    authEnabled,
    unread,
    latest,
    messagesUnread,
  }: {
    account: Account | null;
    authEnabled: boolean;
    unread: number;
    latest: NonNullable<Parameters<typeof NotificationBell>[1]>['latest'];
    messagesUnread: number;
  } = $props();

  const locale = getLocale();
  const STORAGE_KEY = 'nav-expanded';

  // The desktop navigation opens as a sidebar by default. Keep the user's explicit choice
  // between visits, and read it after mount so the server and the first paint agree.
  let expanded = $state(true);
  onMount(() => {
    try {
      const preference = localStorage.getItem(STORAGE_KEY);
      if (preference !== null) expanded = preference === '1';
    } catch {
      // Storage can be blocked; the sidebar keeps its default.
    }
  });
  function toggle() {
    expanded = !expanded;
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
    } catch {
      // Not remembered; it still works for this visit.
    }
  }

  // The rail marks the section you are in, as the bottom tab bar does on phones.
  const pathname = $derived(page.url.pathname);
  const links = $derived(
    [
      {
        href: '/tables',
        label: m.nav_tables(),
        icon: 'game-icons:tavern-sign' as IconName,
        current: pathname.startsWith('/tables') && pathname !== '/tables/new',
      },
      {
        href: '/crowdfunding',
        // The rail is narrow, so it breaks the word where it can (a soft hyphen in the message).
        label: expanded ? m.nav_crowdfunding() : m.nav_crowdfunding_rail(),
        icon: 'game-icons:open-treasure-chest' as IconName,
        current: pathname.startsWith('/crowdfunding'),
      },
      account && {
        href: '/tables/new',
        label: expanded ? m.nav_open_table() : m.nav_open_table_short(),
        icon: 'game-icons:dice-twenty-faces-twenty' as IconName,
        current: pathname === '/tables/new',
      },
      account && {
        href: '/account/tables',
        label: m.nav_my_tables(),
        icon: 'game-icons:tabletop-players' as IconName,
        current: pathname.startsWith('/account/tables'),
      },
    ].filter((link) => !!link),
  );

  const tile = 'flex size-10 shrink-0 items-center justify-center rounded-lg';
</script>

{#snippet collapseButton()}
  <Button
    size="custom"
    type="button"
    onclick={toggle}
    aria-expanded={expanded}
    aria-label={expanded ? m.nav_collapse() : m.nav_expand()}
    title={expanded ? m.nav_collapse() : m.nav_expand()}
    class="btn flex size-11 shrink-0 items-center justify-center rounded-lg p-0 hover:preset-tonal"
  >
    <Icon name={expanded ? 'panel-left-close' : 'panel-left-open'} size={20} />
  </Button>
{/snippet}

{#snippet adminLink()}
  {#if account?.isAdmin}
    <a
      href={localizedHref('/admin', locale)}
      aria-label={expanded ? undefined : m.nav_admin()}
      title={expanded ? undefined : m.nav_admin()}
      aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
      class="group flex w-full items-center rounded-lg p-1 text-sm font-semibold no-underline {expanded
        ? 'gap-3 hover:preset-tonal'
        : 'flex-col justify-center gap-1 text-xs leading-tight'}"
    >
      <span
        class="relative {tile} group-hover:preset-tonal group-aria-[current=page]:bg-surface-200-800"
      >
        <Icon name="game-icons:black-knight-helm" size={20} />
        {#if !expanded && account.pendingSuggestionsCount > 0}
          <span
            aria-label={m.nav_admin() + `: ${account.pendingSuggestionsCount}`}
            class="absolute -top-1 -right-1 badge min-w-5 rounded-full preset-filled-warning-500 px-1 text-xs font-bold"
          >
            {account.pendingSuggestionsCount > 9 ? '9+' : account.pendingSuggestionsCount}
          </span>
        {/if}
      </span>
      <span>{m.nav_admin()}</span>
      {#if expanded && account.pendingSuggestionsCount > 0}
        <span
          aria-label={m.nav_admin() + `: ${account.pendingSuggestionsCount}`}
          class="ml-auto badge min-w-6 rounded-full preset-filled-warning-500 px-1 text-xs font-bold"
        >
          {account.pendingSuggestionsCount > 9 ? '9+' : account.pendingSuggestionsCount}
        </span>
      {/if}
    </a>
  {/if}
{/snippet}

<Navigation
  layout={expanded ? 'sidebar' : 'rail'}
  aria-label={m.nav_main()}
  class="flex h-full flex-col items-stretch gap-4 border-r border-surface-200-800 py-5 {expanded
    ? 'w-60 px-3'
    : 'w-24 px-2'}"
>
  {#snippet element(attributes)}
    <nav {...attributes as Record<string, unknown>}>
      <Navigation.Header
        class="flex gap-4 {expanded
          ? 'flex-row items-center justify-between'
          : 'flex-col items-center'}"
      >
        <a
          href={localizedHref('/', locale)}
          aria-label="Mesa Aberta"
          class="flex min-w-0 items-center gap-3 no-underline {expanded ? 'px-1' : ''}"
        >
          <TableLogo size={32} />
          {#if expanded}
            <span class="font-brand text-xl font-semibold tracking-wider">Mesa Aberta</span>
          {/if}
        </a>
        {@render collapseButton()}
      </Navigation.Header>

      <Navigation.Content class="flex flex-1 flex-col justify-between gap-4">
        <Navigation.Group class="flex flex-col gap-2">
          <Navigation.Menu class="flex flex-col gap-2">
            {#each links as link (link.href)}
              <Navigation.TriggerAnchor
                href={localizedHref(link.href, locale)}
                aria-current={link.current ? 'page' : undefined}
                aria-label={expanded ? undefined : link.label}
                class="group flex! w-full! items-center rounded-lg! bg-transparent! p-1! text-sm font-semibold no-underline focus-visible:outline-2 focus-visible:outline-primary-500 aria-[current=page]:text-surface-950-50 {expanded
                  ? 'flex-row! justify-start! gap-3!'
                  : 'min-h-20 flex-col! justify-center! gap-1! text-center text-xs! leading-tight!'}"
              >
                <span
                  class="{tile} {link.href === '/tables/new'
                    ? 'preset-filled-primary-500'
                    : 'group-hover:preset-tonal group-aria-[current=page]:bg-surface-200-800'}"
                >
                  <Icon name={link.icon} size={20} />
                </span>
                <span class="min-w-0 whitespace-normal! {expanded ? '' : 'w-full'}"
                  >{link.label}</span
                >
              </Navigation.TriggerAnchor>
            {/each}
          </Navigation.Menu>
        </Navigation.Group>

        <Navigation.Group class="flex flex-col gap-2 {expanded ? 'items-stretch' : 'items-center'}">
          <hr class="my-1 w-full border-surface-200-800" />
          {#if expanded}
            {#if account}
              <Navigation.Label
                class="px-3 text-xs font-semibold tracking-wide text-muted uppercase"
                >{m.nav_account_group()}</Navigation.Label
              >
              <NotificationBell {unread} {latest} placement="right-end" labelled />
              {@render adminLink()}
            {/if}
            <ThemeToggle variant="switch" />
          {:else}
            <div class="flex w-full flex-col items-center justify-center gap-2">
              <ThemeToggle />
              {#if account}
                <NotificationBell {unread} {latest} placement="right-end" />
              {/if}
            </div>
            {@render adminLink()}
          {/if}
          {#if account}
            <AccountMenu
              name={account.displayName}
              username={account.username}
              avatarUrl={account.avatarUrl}
              {messagesUnread}
              placement={expanded ? 'top-start' : 'right-end'}
              compact={!expanded}
            />
          {:else if authEnabled}
            <a
              href={resolve('/login')}
              class="btn flex w-full items-center rounded-lg p-2 text-sm font-semibold whitespace-normal hover:preset-tonal {expanded
                ? 'justify-start gap-3'
                : 'flex-col gap-1'}"
            >
              <Icon name="game-icons:dungeon-gate" size={20} />
              {m.nav_sign_in()}
            </a>
          {/if}
        </Navigation.Group>
      </Navigation.Content>
    </nav>
  {/snippet}
</Navigation>
