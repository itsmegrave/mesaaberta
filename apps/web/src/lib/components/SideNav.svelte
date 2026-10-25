<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import AccountMenu from '#lib/components/AccountMenu.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import NotificationBell from '#lib/components/NotificationBell.svelte';
  import TableLogo from '#lib/components/TableLogo.svelte';
  import ThemeToggle from '#lib/components/ThemeToggle.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';

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

  // The rail marks the section you are in, as the bottom tab bar does on phones. Parceiros has no
  // link in the app chrome.
  const pathname = $derived(page.url.pathname);
  const links = $derived(
    [
      {
        href: '/t',
        label: m.nav_tables(),
        icon: 'game-icons:tavern-sign' as IconName,
        current: (pathname === '/t' || pathname.startsWith('/t/')) && pathname !== '/t/new',
      },
      {
        href: '/cf',
        // The rail is narrow, so it breaks the word where it can (a soft hyphen in the message).
        label: expanded ? m.nav_crowdfunding() : m.nav_crowdfunding_rail(),
        icon: 'game-icons:open-treasure-chest' as IconName,
        current: pathname === '/cf' || pathname.startsWith('/cf/'),
      },
      account && {
        href: '/t/new',
        label: expanded ? m.nav_open_table() : m.nav_open_table_short(),
        icon: 'game-icons:dice-twenty-faces-twenty' as IconName,
        current: pathname === '/t/new',
      },
      account && {
        href: '/u/tables',
        label: m.nav_my_tables(),
        icon: 'game-icons:tabletop-players' as IconName,
        current: pathname === '/u/tables' || pathname.startsWith('/u/tables/'),
      },
    ].filter((link) => !!link),
  );

  const pending = $derived(account?.pendingSuggestionsCount ?? 0);
  const adminCurrent = $derived(pathname === '/admin' || pathname.startsWith('/admin/'));
  const tile = 'flex size-10 shrink-0 items-center justify-center rounded-lg';
  // Open: a 44px row. Rail: a 64px column with the icon on a 40px tile over the label.
  const row =
    'relative flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline';
  const column =
    'group relative flex min-h-14 w-16 flex-col items-center justify-center gap-1 py-1 text-center text-xs leading-tight font-semibold no-underline';
  // Skeleton's trigger is a `btn` with a square rail tile and a tonal hover, hence the `!` overrides.
  function linkClass(current: boolean, primary: boolean) {
    if (!expanded) {
      const ink =
        current || primary ? 'text-surface-950-50' : 'text-muted hover:text-surface-950-50';
      return `${column} aspect-auto! w-16! gap-1! bg-transparent! p-1! hover:bg-transparent! ${ink}`;
    }
    const fill = primary
      ? 'preset-filled-primary-500 hover:preset-filled-primary-500!'
      : current
        ? 'bg-surface-200-800! text-surface-950-50'
        : 'bg-transparent! text-surface-950-50 hover:bg-surface-200-800!';
    return `${row} justify-start! gap-3! px-3! py-0! ${fill}`;
  }
</script>

{#snippet collapseButton()}
  <Button
    size="custom"
    type="button"
    onclick={toggle}
    aria-expanded={expanded}
    aria-label={expanded ? m.nav_collapse() : m.nav_expand()}
    title={expanded ? m.nav_collapse() : m.nav_expand()}
    class="btn flex size-10 shrink-0 items-center justify-center rounded-lg p-0 text-muted hover:preset-tonal {expanded
      ? 'border border-surface-200-800'
      : ''}"
  >
    <Icon name={expanded ? 'panel-left-close' : 'panel-left-open'} size={20} />
  </Button>
{/snippet}

{#snippet count(value: number, label: string, placed: string)}
  <span
    aria-label={label}
    class="badge rounded-full preset-filled-warning-500 text-xs font-bold {placed}"
  >
    {value > 9 ? '9+' : value}
  </span>
{/snippet}

<Navigation
  layout={expanded ? 'sidebar' : 'rail'}
  aria-label={m.nav_main()}
  class="flex h-full flex-col border-r border-surface-200-800 py-5 {expanded
    ? 'w-60 items-stretch gap-6 bg-panel px-3'
    : 'w-20 items-center gap-4 bg-transparent px-0'}"
>
  {#snippet element(attributes)}
    <nav {...attributes as Record<string, unknown>}>
      <Navigation.Header
        class="flex {expanded
          ? 'flex-row items-center justify-between gap-2 pl-1.5'
          : 'flex-col items-center gap-4'}"
      >
        <a
          href="/"
          aria-label="Mesa Aberta"
          class="flex min-w-0 items-center gap-2 text-surface-950-50 no-underline"
        >
          <TableLogo size={32} />
          {#if expanded}
            <span class="font-brand text-lg font-semibold tracking-wide whitespace-nowrap"
              >Mesa Aberta</span
            >
          {/if}
        </a>
        {@render collapseButton()}
      </Navigation.Header>

      <Navigation.Content class="flex flex-1 flex-col {expanded ? 'gap-6' : 'items-center gap-4'}">
        <Navigation.Group>
          <Navigation.Menu
            class="flex flex-col {expanded ? 'gap-1' : 'flex-none justify-start gap-2'}"
          >
            {#each links as link (link.href)}
              {@const primary = link.href === '/t/new'}
              <Navigation.TriggerAnchor
                href={link.href}
                aria-current={link.current ? 'page' : undefined}
                aria-label={expanded ? undefined : link.label}
                class="{linkClass(link.current, primary)} whitespace-normal!"
              >
                {#if expanded}
                  {#if link.current}
                    <span
                      aria-hidden="true"
                      class="absolute inset-y-2.5 -left-3 w-0.75 rounded-full bg-primary-500"
                    ></span>
                  {/if}
                  <span class="flex shrink-0 {primary || link.current ? '' : 'text-muted'}">
                    <Icon name={link.icon} size={20} />
                  </span>
                  <span class="min-w-0 flex-1">{link.label}</span>
                {:else}
                  <span
                    class="{tile} {primary
                      ? 'preset-filled-primary-500'
                      : link.current
                        ? 'bg-surface-200-800'
                        : 'group-hover:bg-surface-200-800'}"
                  >
                    <Icon name={link.icon} size={20} />
                  </span>
                  <span class="w-full min-w-0">{link.label}</span>
                {/if}
              </Navigation.TriggerAnchor>
            {/each}
            {#if account?.isAdmin && !expanded}
              <!-- In the rail Admin follows the links; open, it sits under "Sua conta". -->
              <a
                href="/admin"
                aria-label={m.nav_admin()}
                aria-current={adminCurrent ? 'page' : undefined}
                class="{column} {adminCurrent
                  ? 'text-surface-950-50'
                  : 'text-muted hover:text-surface-950-50'}"
              >
                <span
                  class="{tile} {adminCurrent
                    ? 'bg-surface-200-800'
                    : 'group-hover:bg-surface-200-800'}"
                >
                  <Icon name="game-icons:black-knight-helm" size={20} />
                </span>
                {#if pending > 0}
                  {@render count(
                    pending,
                    `${m.nav_admin()}: ${pending}`,
                    'absolute top-0.5 right-2 h-4 min-w-4 px-1',
                  )}
                {/if}
                <span class="w-full min-w-0">{m.nav_admin()}</span>
              </a>
            {/if}
          </Navigation.Menu>
        </Navigation.Group>

        {#if expanded && account}
          <Navigation.Group class="flex flex-col gap-1">
            <Navigation.Label
              class="px-3 pb-1.5 text-xs font-semibold tracking-wide text-muted uppercase"
              >{m.nav_account_group()}</Navigation.Label
            >
            <NotificationBell {unread} {latest} placement="right-end" labelled />
            {#if account.isAdmin}
              <a
                href="/admin"
                aria-current={adminCurrent ? 'page' : undefined}
                class="{row} text-surface-950-50 hover:bg-surface-200-800 aria-[current=page]:bg-surface-200-800"
              >
                <span class="flex shrink-0 text-muted">
                  <Icon name="game-icons:black-knight-helm" size={20} />
                </span>
                <span class="min-w-0 flex-1">{m.nav_admin()}</span>
                {#if pending > 0}
                  {@render count(pending, `${m.nav_admin()}: ${pending}`, 'h-5.5 min-w-5.5 px-1.5')}
                {/if}
              </a>
            {/if}
          </Navigation.Group>
        {/if}

        <Navigation.Group
          class="mt-auto flex flex-col {expanded ? 'items-stretch gap-2' : 'items-center gap-3'}"
        >
          {#if account && !expanded}
            <NotificationBell {unread} {latest} placement="right-end" />
          {/if}
          <ThemeToggle labelled={expanded} />
          {#if account}
            <AccountMenu
              name={account.displayName}
              username={account.username}
              avatarUrl={account.avatarUrl}
              {messagesUnread}
              placement={expanded ? 'top-start' : 'right-end'}
              compact={!expanded}
              wide={expanded}
            />
          {:else if authEnabled}
            <a
              href={resolve('login')}
              class="btn flex items-center rounded-lg p-2 text-sm font-semibold whitespace-normal hover:preset-tonal {expanded
                ? 'w-full justify-start gap-3'
                : 'w-16 flex-col gap-1 text-xs'}"
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
