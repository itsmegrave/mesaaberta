<script lang="ts">
  import './layout.css';
  import { createQuery, QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '$lib/query/client';
  import { provideQueryClient } from '$lib/query/context';
  import { pageQuery } from '$lib/query/page.svelte';
  import { apiRead } from '$lib/api/http';
  import { BADGES_KEY, type Badges } from '$lib/query/badges';
  import { browser } from '$app/environment';
  const client = createQueryClient();
  provideQueryClient(client);
  import { asset, resolve } from '$app/paths';
  import { invalidateAll } from '$app/navigation';
  import { navigating, page, updated } from '$app/state';
  import AccountMenu from '$lib/components/AccountMenu.svelte';
  import BottomTabBar from '$lib/components/BottomTabBar.svelte';
  import ListSkeleton, { type SkeletonKind } from '$lib/components/ListSkeleton.svelte';
  import NotificationBell from '$lib/components/NotificationBell.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SideNav from '$lib/components/SideNav.svelte';
  import TableLogo from '$lib/components/TableLogo.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import Toaster from '$lib/components/Toaster.svelte';
  import UnsavedChangesDialog from '$lib/components/UnsavedChangesDialog.svelte';
  import { Progress } from '@skeletonlabs/skeleton-svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { Slow } from '$lib/navigation/slow.svelte';
  import { syncBrowserTimezone } from '$lib/time/browser-timezone';
  import { onMount } from 'svelte';

  let { children, data: layoutData } = $props();
  const accountQuery = pageQuery(() => layoutData.accountRead ?? { summary: null }, client);
  const data = $derived({
    ...layoutData,
    account: layoutData.account && {
      ...layoutData.account,
      ...(accountQuery.data?.summary ?? {}),
    },
  });
  // The bell and the messages link count what is unread. The count is read again every 30 seconds
  // while the tab is visible and when it comes back into focus (a background tab does not poll).
  const badges = createQuery(
    () => ({
      queryKey: BADGES_KEY,
      queryFn: ({ signal }: { signal: AbortSignal }) => apiRead<Badges>('/api/badges', signal),
      enabled: browser && !!layoutData.account,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }),
    () => client,
  );
  // A page load with other numbers (a notification was read, say) makes the poll catch up.
  $effect(() => {
    void layoutData.account?.notifications.unread;
    void layoutData.account?.messagesUnread;
    void client.invalidateQueries({ queryKey: BADGES_KEY });
  });

  // Identity is intentionally captured once, then compared on each server navigation.
  // svelte-ignore state_referenced_locally
  let previousIdentity = layoutData.cacheIdentity;
  $effect.pre(() => {
    const identity = layoutData.cacheIdentity;
    if (identity !== previousIdentity) {
      client.clear();
      previousIdentity = identity;
    }
  });

  // Times follow the visitor's timezone. Without one on the profile, the browser's is sent in a
  // cookie; the first page, rendered in the default zone, then loads again in the right one.
  onMount(() => {
    if (syncBrowserTimezone(data.viewer)) invalidateAll();
  });

  const locale = getLocale();

  // Loading shows only after 150 ms, so a quick navigation does not flash the bar or a skeleton.
  const loading = new Slow(() => navigating.to, 150);
  const SKELETONS: Record<string, SkeletonKind> = {
    '/tables': 'cards',
    '/account/tables': 'columns',
    '/notifications': 'rows',
  };
  // A list page on its way from another page: its skeleton stands in for the page being left. Within
  // the same page (a filter), the page draws its own skeleton under the filters.
  const arriving = $derived.by(() => {
    const to = loading.current;
    if (!to?.route.id || to.route.id === page.route.id) return null;
    return SKELETONS[to.route.id] ?? null;
  });
</script>

<svelte:head>
  <link rel="apple-touch-icon" sizes="180x180" href={asset('/apple-touch-icon.png')} />
  <link rel="icon" type="image/png" sizes="32x32" href={asset('/favicon-32x32.png')} />
  <link rel="icon" type="image/png" sizes="16x16" href={asset('/favicon-16x16.png')} />
  <link rel="manifest" href={asset('/site.webmanifest')} />
  {#if data.maintenance}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>

<QueryClientProvider {client}>
  <a
    href="#main"
    class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface-100-900 focus:px-3 focus:py-2 focus:text-surface-950-50 focus:shadow-md"
  >
    {m.skip_to_content()}
  </a>

  {#if data.maintenanceBypass}
    <p role="status" class="preset-filled-warning-500 px-5 py-2 text-center text-sm font-semibold">
      {m.maintenance_admin_banner()}
    </p>
  {/if}

  <div class="md:flex">
    {#if !data.maintenance}
      <div class="sticky top-0 hidden h-dvh shrink-0 md:block">
        <SideNav
          account={data.account}
          released={data.released}
          authEnabled={data.authEnabled}
          unread={badges.data?.unread ?? data.account?.notifications.unread ?? 0}
          latest={data.account?.notifications.latest ?? []}
          messagesUnread={badges.data?.messages ?? data.account?.messagesUnread ?? 0}
        />
      </div>
    {/if}

    <div class="min-w-0 flex-1">
      <!-- On desktop the side rail carries the links and account; the header is the phone's. -->
      <header
        class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 {data.maintenance
          ? 'md:h-20 md:px-8'
          : 'md:hidden'}"
      >
        <a href={localizedHref('/', locale)} class="flex items-center gap-2 no-underline md:gap-3">
          <TableLogo size={34} class="size-7 md:size-8" />
          <span class="font-brand text-lg font-semibold tracking-wider md:text-2xl">
            Mesa Aberta
          </span>
        </a>

        {#if !data.maintenance}
          <div class="flex items-center gap-2">
            <ThemeToggle />

            {#if data.account}
              <NotificationBell
                unread={badges.data?.unread ?? data.account.notifications.unread}
                latest={data.account.notifications.latest}
              />
              <AccountMenu
                name={data.account.displayName}
                avatarUrl={data.account.avatarUrl}
                messagesUnread={badges.data?.messages ?? data.account.messagesUnread}
              />
            {:else if data.authEnabled && data.released}
              <a
                href={resolve('/login')}
                class="btn h-12 rounded-lg preset-outlined-primary-500 px-4 font-semibold"
              >
                <Icon name="game-icons:dungeon-gate" size={20} />
                {m.nav_sign_in()}
              </a>
            {/if}
          </div>
        {/if}
      </header>

      {#if updated.current}
        <aside
          role="status"
          class="mx-auto mt-2 flex w-[calc(100%-2.5rem)] max-w-7xl flex-wrap items-center justify-between gap-3 rounded-lg border border-primary-500 bg-primary-50-950 px-4 py-3 text-sm font-semibold text-primary-950-50 md:w-[calc(100%-4rem)]"
        >
          <p>{m.version_update_available()}</p>
          <button class="btn preset-filled-primary-500" onclick={() => location.reload()}>
            {m.version_update_refresh()}
          </button>
        </aside>
      {/if}

      <!-- Announced to screen readers and shown while a page's data loads, so a slow tap is not silent. -->
      {#if loading.current}
        <Progress value={null} class="fixed inset-x-0 top-0 z-50" aria-label={m.nav_loading()}>
          <Progress.Track class="h-1">
            <Progress.Range />
          </Progress.Track>
        </Progress>
      {/if}

      <Toaster />
      <UnsavedChangesDialog />

      <main id="main" class="mx-auto w-full max-w-7xl px-5 pb-8 md:px-8 md:pb-10">
        {#if arriving}
          <ListSkeleton kind={arriving} heading />
        {:else}
          {@render children()}
        {/if}
      </main>

      {#if data.released && !data.maintenance}
        <BottomTabBar isAdmin={data.account?.isAdmin} />
      {/if}

      {#if !data.maintenance}
        <footer class="mx-auto w-full max-w-7xl px-5 pb-24 md:px-8 md:pb-0">
          <div
            class="flex flex-col gap-5 border-t border-surface-200-800 pt-7 pb-9 text-sm leading-relaxed text-muted md:flex-row md:items-start md:justify-between md:gap-12 md:pt-9 md:pb-11"
          >
            <div class="flex flex-col gap-3">
              <p class="flex items-center gap-2 text-surface-950-50">
                <TableLogo size={26} />
                <span class="font-brand text-lg font-semibold tracking-wider">Mesa Aberta</span>
              </p>
              <p class="md:max-w-md">
                {m.footer_made_with()}
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label={m.footer_made_with_love()}
                  class="inline shrink-0 fill-secondary-300 align-middle"
                >
                  <path
                    d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 4.6 2.7h1c1-1.6 2.6-2.7 4.6-2.7 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
                  />
                </svg>
                {m.footer_made_by()}
                <a
                  href="https://github.com/itsmegrave"
                  rel="noopener"
                  target="_blank"
                  class="link-underline text-surface-950-50">itsmegrave</a
                >. {m.footer_open_source()}
                <a
                  href="https://github.com/itsmegrave/mesaaberta"
                  rel="noopener"
                  target="_blank"
                  class="link-underline text-surface-950-50">GitHub</a
                >.
              </p>
            </div>
            <div class="flex flex-col gap-3 md:max-w-sm">
              <p>
                {m.footer_community()}
                <a
                  href="https://linktr.ee/lenindragonsrpg"
                  rel="noopener"
                  target="_blank"
                  class="link-underline text-surface-950-50">Lenindragons</a
                >.
              </p>
              <p>
                {m.footer_report_bug()}
                <a
                  href="https://github.com/itsmegrave/mesaaberta/issues"
                  rel="noopener"
                  target="_blank"
                  class="link-underline text-surface-950-50">{m.footer_report_bug_link()}</a
                >.
              </p>
              <p>
                {m.footer_changelog()}
                <a
                  href={localizedHref('/changelog', locale)}
                  class="link-underline text-surface-950-50">{m.footer_changelog_link()}</a
                >.
              </p>
            </div>
          </div>
        </footer>
      {/if}
    </div>
  </div>
</QueryClientProvider>
