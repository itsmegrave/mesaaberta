<script lang="ts">
  // Início for a signed-in member (`use_signed_in_home`): what waits on them, their next sessions,
  // Sua conta and news from people they follow, then tables from their systems, from people they
  // follow, and Novas mesas. Each block shows only with something in it, but the two rows of
  // discovery, which turn into a way to start.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import NewTableCard from '#lib/components/ui/NewTableCard.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import TableCarousel from '#lib/components/ui/TableCarousel.svelte';
  import { formatSession } from '@mesaaberta/core/tables/format';
  import { routes } from '@mesaaberta/core/routes';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { shownTimezone } from '#lib/time/shown-timezone.js';
  import { m } from '#lib/paraglide/messages.js';
  import HomeAccount from './ui/HomeAccount.svelte';
  import HomeFeed from './ui/HomeFeed.svelte';
  import HomeFollowSuggestions from './ui/HomeFollowSuggestions.svelte';
  import HomeSessions from './ui/HomeSessions.svelte';
  import HomeWaiting from './ui/HomeWaiting.svelte';
  import HomeSystemsPicker from './HomeSystemsPicker.svelte';
  import type { PageData } from '../$types';

  let { data }: { data: Extract<PageData, { signedInHome: true }> } = $props();

  const next = $derived(data.sessions.next[0]);
  const summary = $derived.by(() => {
    if (data.waiting.total > 0)
      return m.home_summary_week({ sessions: data.sessions.thisWeek, waiting: data.waiting.total });
    if (!next) return m.home_summary_idle();
    const when = formatSession(next.startsAt, shownTimezone(next.timezone), getLocale());
    return m.home_summary_idle_next({ when });
  });
  const systemsHref = $derived(
    `${routes.tables}?${data.favoriteSystems.map((slug) => `system=${encodeURIComponent(slug)}`).join('&')}`,
  );
</script>

{#snippet emptyRow(id: string, title: string, text: string, href: string, label: string)}
  <section aria-labelledby={id} class="flex flex-col gap-4">
    <h2 {id} class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-4xl">
      {title}
    </h2>
    <div
      class="flex flex-col gap-4 rounded-lg border border-surface-200-800 bg-panel p-5 md:flex-row md:items-center md:justify-between md:p-6"
    >
      <p class="max-w-xl">{text}</p>
      <a {href} class="{buttonClass('secondary', 'sm')} shrink-0 font-semibold">{label}</a>
    </div>
  </section>
{/snippet}

<div class="flex flex-col gap-8 pt-5 pb-10 md:gap-12 md:pt-8 md:pb-14">
  <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
        {m.home_greeting({ name: data.name })}
      </h1>
      <p class="mt-3 text-lg text-muted">{summary}</p>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row sm:gap-3">
      <a href={routes.tables} class="{buttonClass('primary')} gap-2 font-semibold">
        <Icon name="search" size={18} />{m.home_browse()}
      </a>
      <a href={routes.newTable} class="{buttonClass('secondary')} gap-2 font-semibold">
        <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />{m.home_open_table()}
      </a>
    </div>
  </header>

  <div class="grid gap-4 md:grid-cols-3 md:gap-6">
    <div class="flex flex-col gap-4 md:col-span-2 md:gap-6">
      {#if data.waiting.total > 0}
        <HomeWaiting items={data.waiting.items} total={data.waiting.total} />
      {/if}
      {#if data.sessions.next.length > 0}
        <HomeSessions sessions={data.sessions.next} now={data.now} />
      {/if}
    </div>
    <div class="flex flex-col gap-4 md:gap-6">
      <HomeAccount
        account={data.account}
        following={data.following}
        username={data.username}
        now={data.now}
      />
      {#if data.feed.length > 0}
        <HomeFeed feed={data.feed} now={data.now} />
      {/if}
    </div>
  </div>

  {#if data.systemsCatalog}
    <HomeSystemsPicker systems={data.systemsCatalog} show={data.showFavoriteSystems} />
  {:else if data.rows.systems.length > 0}
    <TableCarousel
      id="home-systems"
      title={m.home_row_systems()}
      items={data.rows.systems}
      key={(table) => table.slug}
      itemClass="w-75 md:w-96"
      moreHref={systemsHref}
      moreCaption={m.home_row_systems_more()}
    >
      {#snippet action()}
        <a href="/u/profile/edit/systems" class="text-sm font-semibold"
          >{m.home_row_systems_edit()}</a
        >
      {/snippet}
      {#snippet card(table)}<TableCard {table} />{/snippet}
    </TableCarousel>
  {:else}
    {@render emptyRow(
      'home-systems',
      m.home_row_systems(),
      m.home_row_systems_empty(),
      routes.tables,
      m.home_row_systems_all(),
    )}
  {/if}

  {#if data.rows.followed !== null}
    {#if data.following === 0}
      <HomeFollowSuggestions people={data.suggestions} />
    {:else if data.rows.followed.length > 0}
      <TableCarousel
        id="home-followed"
        title={m.home_row_followed()}
        items={data.rows.followed}
        key={(table) => table.slug}
        itemClass="w-75 md:w-96"
      >
        {#snippet card(table)}<TableCard {table} />{/snippet}
      </TableCarousel>
    {:else}
      {@render emptyRow(
        'home-followed',
        m.home_row_followed(),
        m.home_row_followed_empty(),
        '/u/profile/edit/following',
        m.home_feed_manage(),
      )}
    {/if}
  {/if}

  {#if data.rows.fresh.length > 0}
    <TableCarousel
      id="new-tables"
      title={m.home_new_tables_title()}
      lede={m.home_new_tables_lede()}
      items={data.rows.fresh}
      key={(table) => table.slug}
      itemClass="w-65 md:w-70"
      moreHref={routes.tables}
      moreCaption={m.home_carousel_more_caption()}
    >
      {#snippet card(table)}<NewTableCard {table} now={data.now} />{/snippet}
    </TableCarousel>
  {/if}
</div>
