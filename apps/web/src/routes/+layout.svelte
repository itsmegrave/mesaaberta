<script lang="ts">
  import SeoHead from '#lib/seo/SeoHead.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import './layout.css';
  import { createQuery, QueryClientProvider } from '@tanstack/svelte-query';
  import { createQueryClient } from '#lib/query/client.js';
  import { provideQueryClient } from '#lib/query/context.js';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import { apiRead } from '#lib/api/http.js';
  import { BADGES_KEY, type Badges } from '#lib/query/badges.js';
  import { browser } from '$app/env';
  const client = createQueryClient();
  provideQueryClient(client);
  import { asset, resolve } from '$app/paths';
  import { refreshAll } from '$app/navigation';
  import { navigating, page, updated } from '$app/state';
  import ExtensionWidgets from '#lib/components/shell/ExtensionWidgets.svelte';
  import AccountMenu from '#lib/components/shell/AccountMenu.svelte';
  import BottomTabBar from '#lib/components/shell/BottomTabBar.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import NotificationBell from '#lib/components/shell/NotificationBell.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import SideNav from '#lib/components/shell/SideNav.svelte';
  import SiteFooter from '#lib/components/shell/SiteFooter.svelte';
  import TableLogo from '#lib/components/ui/TableLogo.svelte';
  import ThemeToggle from '#lib/components/shell/ThemeToggle.svelte';
  import MAToaster from '#lib/components/shell/MAToaster.svelte';
  import UnsavedChangesDialog from '#lib/components/shell/UnsavedChangesDialog.svelte';
  import { Progress } from '@skeletonlabs/skeleton-svelte';
  import { m } from '#lib/paraglide/messages.js';

  import { isUnder } from '#lib/navigation/main-nav.js';
  import { directoryNav } from '#lib/navigation/directory-nav.js';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { inFlight } from '#lib/forms/in-flight.svelte.js';
  import { arrivingSkeleton } from '#lib/navigation/skeletons.js';
  import { reloadPage } from '#lib/forms/leave-guard.svelte.js';
  import { syncBrowserTimezone } from '#lib/time/browser-timezone.js';
  import { onMount } from 'svelte';

  let { children, data: layoutData } = $props();
  const accountQuery = pageQuery(() => layoutData.accountRead ?? { summary: null }, client);
  const data = $derived({
    ...layoutData,
    account: layoutData.account && { ...layoutData.account, ...(accountQuery.data?.summary ?? {}) },
  });
  // The directories whose flag is on, for the sidebar and the phone's Explorar.
  const directories = $derived(directoryNav(data.directories));
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
    if (syncBrowserTimezone(data.viewer)) refreshAll();
  });

  // Loading shows only after 150 ms, so a quick navigation does not flash the bar or a skeleton.
  const loading = new Slow(() => navigating.to, 150);
  // An action on its way shows the same bar, so one sent from a menu item is not silent either.
  const acting = new Slow(() => (inFlight.count > 0 ? true : null), 150);
  // A list or item page on its way gets its skeleton in place of the page being left.
  const arriving = $derived(arrivingSkeleton(page.url, loading.current));
</script>

<svelte:head>
  <link rel="apple-touch-icon" sizes="180x180" href={asset('apple-touch-icon.png')} />

  <link rel="icon" type="image/png" sizes="32x32" href={asset('favicon-32x32.png')} />

  <link rel="icon" type="image/png" sizes="16x16" href={asset('favicon-16x16.png')} />

  <link rel="icon" type="image/svg+xml" sizes="any" href={asset('favicon.svg')} />

  <link rel="manifest" href={asset('site.webmanifest')} />
</svelte:head>

<SeoHead />

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
      <div class="sticky top-0 z-20 hidden h-dvh shrink-0 md:block">
        <SideNav
          account={data.account}
          authEnabled={data.authEnabled}
          unread={badges.data?.unread ?? data.account?.notifications.unread ?? 0}
          latest={data.account?.notifications.latest ?? []}
          seenAt={data.account?.notifications.seenAt}
          messagesUnread={badges.data?.messages ?? data.account?.messagesUnread ?? 0}
          {directories}
        />
      </div>
    {/if}

    <!-- Clip full-width page backgrounds at the content boundary beside the sidebar. -->
    <div class="min-w-0 flex-1 overflow-x-clip">
      <!-- On desktop the side rail carries the links and account; the header is the phone's. -->
      <header
        class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 {data.maintenance
          ? 'md:h-20 md:px-8'
          : 'md:hidden'}"
      >
        <a href="/" class="flex items-center gap-2 no-underline md:gap-3">
          <TableLogo size={34} class="size-7 md:size-8" />
          <span class="font-brand text-lg font-semibold tracking-wider md:text-2xl">
            Mesa Aberta
          </span>
        </a>

        {#if !data.maintenance}
          <div class="flex items-center gap-2">
            {#if data.account}
              <NotificationBell
                unread={badges.data?.unread ?? data.account.notifications.unread}
                latest={data.account.notifications.latest}
                seenAt={data.account.notifications.seenAt}
              />
              <AccountMenu
                name={data.account.displayName}
                username={data.account.username}
                avatarUrl={data.account.avatarUrl}
                messagesUnread={badges.data?.messages ?? data.account.messagesUnread}
                isAdmin={data.account.isAdmin}
                adminPending={data.account.pendingSuggestionsCount}
                sheet
              />
            {:else}
              <!-- Members pick the theme in the account menu; visitors have none. -->
              <ThemeToggle />
            {/if}
            {#if !data.account && data.authEnabled}
              <a
                href={resolve('login')}
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
          <MAButton
            size="custom"
            class="btn preset-filled-primary-500"
            onclick={() => void reloadPage()}
          >
            {m.version_update_refresh()}
          </MAButton>
        </aside>
      {/if}

      <!-- Announced to screen readers and shown while a page's data loads, so a slow tap is not silent.
           A 4px primary line along the top edge; with reduced motion it stands still, full width. -->
      {#if loading.current || acting.current}
        <Progress value={null} class="fixed inset-x-0 top-0 z-50" aria-label={m.nav_loading()}>
          <Progress.Track data-nav-progress class="h-1 rounded-none bg-transparent">
            <Progress.Range
              class="rounded-none bg-primary-500 motion-reduce:animate-none motion-reduce:opacity-60"
            />
          </Progress.Track>
        </Progress>
      {/if}

      <MAToaster />
      <UnsavedChangesDialog />
      {#if data.account && !data.maintenance && !isUnder(page.url.pathname, '/messages') && !isUnder(page.url.pathname, '/m')}
        <!-- Its own chunk: the chat (thread, composer, emoji picker) loads only for the signed-in. -->
        {#await import('#lib/components/chat/ChatDrawer.svelte') then { default: ChatDrawer }}
          {#key data.cacheIdentity}<ChatDrawer
              viewerId={data.cacheIdentity ?? 'anonymous'}
              unread={badges.data?.messages ?? data.account.messagesUnread}
            />{/key}
        {/await}
      {/if}
      {#if data.account && !data.maintenance}
        {#key data.cacheIdentity}<ExtensionWidgets />{/key}
      {/if}

      <main id="main" class="mx-auto w-full max-w-7xl px-5 pb-8 md:px-8 md:pb-10">
        {#if arriving}
          <ListSkeleton kind={arriving} heading />
        {:else}
          {@render children()}
        {/if}
      </main>

      {#if !data.maintenance}
        <BottomTabBar {directories} />
      {/if}

      {#if !data.maintenance}
        <SiteFooter site={data.site} directories={data.directories} blogLive={data.blogLive} />
      {/if}
    </div>
  </div>
</QueryClientProvider>
