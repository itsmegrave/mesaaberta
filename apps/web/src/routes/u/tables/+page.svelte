<script lang="ts">
  import { Tabs } from '@skeletonlabs/skeleton-svelte';
  import { flushSync, onMount, type Snippet } from 'svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PlayingCard from './components/PlayingCard.svelte';
  import RunningCard from './components/RunningCard.svelte';
  import { page } from '$app/state';
  import { pageHref } from '#lib/admin/page-href.js';
  import Icon from '#lib/components/ui/Icon.svelte';
  import KebabMenu from '#lib/components/ui/KebabMenu.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import Pill from '#lib/components/ui/Pill.svelte';
  import { formatSession } from '@mesaaberta/core/tables/format';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  const invitations = $derived(
    data.invitations.filter(
      (invitation) => invitation.status === 'pending' && invitation.expiresAt > new Date(),
    ),
  );
  // Every action posted from here comes back here.
  const next = '/u/tables';

  // A banner for the requests waiting on the GM (across every page), pointing at the first table
  // that has one, on the page it is on.
  const banner = $derived(
    !data.waiting
      ? null
      : data.waiting.tables > 1
        ? m.dash_banner_many({ count: data.waiting.requests, tables: data.waiting.tables })
        : m.dash_banner({ count: data.waiting.requests, title: data.waiting.first.title }),
  );
  // On a phone the two lists are tabs; from `lg` up they sit side by side and the tabs are not
  // drawn. Someone who only runs tables lands on theirs.
  type Tab = 'playing' | 'running';
  // svelte-ignore state_referenced_locally
  let tab = $state<Tab>(
    data.totals.playing === 0 && data.totals.running > 0 ? 'running' : 'playing',
  );

  // A link to one of the GM's tables (the banner, or a shared `#mesa-...`) opens their tab first,
  // so the browser has something to scroll to.
  const showRunning = () => flushSync(() => (tab = 'running'));
  onMount(() => {
    // Slugs are plain ASCII, so the id is the hash as is; decoding it could throw on a mangled link.
    if (location.hash.startsWith('#mesa-')) {
      showRunning();
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    }
  });

  const tabs = $derived([
    ['playing', m.dash_tab_playing({ count: data.totals.playing })],
    ['running', m.dash_tab_running({ count: data.totals.running })],
  ] as const);

  // The tab's panel, which stays drawn from `lg` up whatever tab is selected.
  const panelClass = (value: Tab) => (tab === value ? '' : 'max-lg:hidden');
</script>

<!-- One of the two lists, a tab on a phone and a column from `lg` up. -->
{#snippet column(
  list: {
    value: Tab;
    title: string;
    total: number;
    shown: number;
    empty: string;
    href: string;
    cta: string;
  },
  cards: Snippet,
)}
  <Tabs.Content value={list.value}>
    {#snippet element(attributes)}
      <div {...attributes} hidden={false} class={panelClass(list.value)}>
        <!-- A region of its own, as it was before the tabs: on a wide screen the tabs are not drawn. -->
        <section aria-labelledby={list.value}>
          <div class="flex items-baseline gap-3">
            <h2 id={list.value} class="text-2xl font-semibold tracking-tight">
              {list.title}
            </h2>
            <span class="text-sm font-semibold text-muted"
              >{m.dash_count({ count: list.total })}</span
            >
          </div>
          {#if list.shown === 0}
            <p class="mt-3">
              {list.empty}
            </p>
            <a href={list.href} class="mt-2 inline-block anchor">
              {list.cta}
            </a>
          {:else}
            <ul class="mt-5 grid gap-5">
              {@render cards()}
            </ul>
          {/if}
        </section>
      </div>
    {/snippet}
  </Tabs.Content>
{/snippet}

<svelte:head>
  <title>{m.dash_title()}</title>
</svelte:head>
<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs class="mb-8" items={[{ label: m.nav_my_tables() }]} />
  {#if invitations.length > 0}
    <section
      aria-labelledby="received-invitations"
      class="mb-6 rounded-lg border border-surface-200-800 bg-panel p-6"
    >
      <div class="flex items-center gap-3">
        <h2 id="received-invitations" class="text-2xl font-semibold">
          {m.invitation_received()}
        </h2>
        <Pill tone="warning"
          ><span class="sr-only">{m.invitation_received_count({ count: invitations.length })}</span
          ><span aria-hidden="true">{invitations.length}</span></Pill
        >
      </div>
      <ul class="mt-3">
        {#each invitations as invitation (invitation.id)}
          <li class="flex min-h-16 items-center gap-3 py-2">
            <MAAvatar name={invitation.table.title} size={36} class="shrink-0" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-semibold">{invitation.table.title}</span>
              <span class="text-sm text-muted">
                {m.invitation_row({
                  gm: invitation.gmUsername || '',
                  date: formatSession(
                    new Date(invitation.expiresAt),
                    invitation.table.timezone,
                    getLocale(),
                  ),
                })}
              </span>
            </span>
            <a
              href="/u/profile/invitations/{invitation.id}"
              class="{buttonClass('primary', 'sm')} shrink-0 font-semibold"
              aria-label={m.invitation_respond_to({ title: invitation.table.title })}
              >{m.invitation_respond()}</a
            >
          </li>
        {/each}
      </ul>
    </section>
  {/if}
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
    <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
      {m.dash_title()}
    </h1>
    <div class="flex flex-col gap-3 sm:flex-row">
      <a href="/tables" class="btn h-11 rounded-lg border-2 border-primary-500 px-6 font-semibold"
        >{m.dash_find_table()}</a
      >
      <a
        href="/tables/new"
        class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
      >
        <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />
        {m.tables_open_cta()}
      </a>
      <KebabMenu
        name={m.dash_title()}
        class="self-end sm:self-auto"
        items={[
          {
            id: 'calendar',
            label: m.menu_download_calendar(),
            icon: 'calendar',
            href: '/u/tables/calendar',
            download: true,
          },
        ]}
      />
    </div>
  </div>

  <Tabs value={tab} onValueChange={(details) => (tab = details.value as Tab)} composite={false}>
    <Tabs.List
      aria-label={m.dash_title()}
      class="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-surface-950-50/5 p-1 lg:hidden"
    >
      {#each tabs as [value, label] (value)}
        <Tabs.Trigger
          {value}
          class="btn h-11 rounded-lg font-semibold aria-selected:preset-filled-primary-500"
          >{label}</Tabs.Trigger
        >
      {/each}
    </Tabs.List>

    {#if banner}
      <div
        role="status"
        class="mt-6 flex flex-wrap items-center gap-4 rounded-lg border border-lamp bg-lamp-wash px-5 py-4"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0 text-lamp"
          ><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5zM10 20.5a2 2 0 0 0 4 0" /></svg
        >
        <p class="text-lg font-semibold">{banner}</p>
        {#if data.waiting && data.waiting.first.page !== data.page}
          <a
            href="{pageHref('/u/tables', page.url.searchParams, data.waiting.first.page)}#mesa-{data
              .waiting.first.slug}"
            class="{buttonClass('primary')} font-semibold sm:ml-auto">{m.dash_banner_action()}</a
          >
        {:else}
          <a
            href="#mesa-{data.waiting?.first.slug}"
            onclick={showRunning}
            class="{buttonClass('primary')} font-semibold sm:ml-auto">{m.dash_banner_action()}</a
          >
        {/if}
      </div>
    {/if}

    <div class="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-2 lg:gap-12">
      {#snippet playingCards()}
        {#each data.playing as item (item.slug)}
          <li><PlayingCard {item} {next} /></li>
        {/each}
      {/snippet}
      {#snippet runningCards()}
        {#each data.running as item, index (item.slug)}
          <li><RunningCard {item} {next} openPlayers={index === 0} /></li>
        {/each}
      {/snippet}
      {@render column(
        {
          value: 'playing',
          title: m.dash_playing(),
          total: data.totals.playing,
          shown: data.playing.length,
          empty: data.totals.playing === 0 ? m.dash_playing_empty() : m.dash_page_empty(),
          href: '/tables',
          cta: m.dash_find_table(),
        },
        playingCards,
      )}
      {@render column(
        {
          value: 'running',
          title: m.dash_running(),
          total: data.totals.running,
          shown: data.running.length,
          empty: data.totals.running === 0 ? m.dash_running_empty() : m.dash_page_empty(),
          href: '/tables/new',
          cta: m.tables_open_cta(),
        },
        runningCards,
      )}
    </div>
  </Tabs>

  <Pager
    compact
    class="mt-10"
    page={data.page}
    pages={data.pages}
    href={(number) => pageHref('/u/tables', page.url.searchParams, number)}
  />
</section>
