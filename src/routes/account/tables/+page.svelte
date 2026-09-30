<script lang="ts">
  import { Tabs } from '@skeletonlabs/skeleton-svelte';
  import { flushSync, onMount } from 'svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import PlayingCard from '$lib/components/PlayingCard.svelte';
  import RunningCard from '$lib/components/RunningCard.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  const locale = getLocale();
  // Every action posted from here comes back here.
  const next = localizedHref('/account/tables', locale);

  const count = (n: number) => (n === 1 ? m.dash_count_one() : m.dash_count({ count: n }));

  // A banner for the requests waiting on the GM, pointing at the first table that has one.
  const waiting = $derived(data.running.filter((table) => table.requests.length > 0));
  const pendingCount = $derived(waiting.reduce((sum, table) => sum + table.requests.length, 0));
  const banner = $derived(
    waiting.length === 0
      ? null
      : waiting.length > 1
        ? m.dash_banner_many({ count: pendingCount, tables: waiting.length })
        : pendingCount === 1
          ? m.dash_banner_one({ title: waiting[0].title })
          : m.dash_banner({ count: pendingCount, title: waiting[0].title }),
  );

  // On a phone the two lists are tabs; from `lg` up they sit side by side and the tabs are not
  // drawn. Someone who only runs tables lands on theirs.
  type Tab = 'playing' | 'running';
  // svelte-ignore state_referenced_locally
  let tab = $state<Tab>(
    data.playing.length === 0 && data.running.length > 0 ? 'running' : 'playing',
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
    ['playing', m.dash_tab_playing({ count: data.playing.length })],
    ['running', m.dash_tab_running({ count: data.running.length })],
  ] as const);

  // The tab's panel, which stays drawn from `lg` up whatever tab is selected.
  const panelClass = (value: Tab) => (tab === value ? '' : 'max-lg:hidden');
</script>

<svelte:head>
  <title>{m.dash_title()}</title>
</svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs class="mb-8" items={[{ label: m.nav_my_tables() }]} />
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
    <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
      {m.dash_title()}
    </h1>
    <div class="flex flex-col gap-3 sm:flex-row">
      <a
        href={localizedHref('/tables', locale)}
        class="btn h-12 rounded-lg border-2 border-primary-500 px-6 font-semibold"
        >{m.dash_find_table()}</a
      >
      <a
        href={localizedHref('/tables/new', locale)}
        class="btn h-12 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
        >
        {m.tables_open_cta()}
      </a>
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
        <a
          href="#mesa-{waiting[0].slug}"
          onclick={showRunning}
          class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold sm:ml-auto"
          >{m.dash_banner_action()}</a
        >
      </div>
    {/if}

    <div class="mt-6 grid gap-10 lg:mt-8 lg:grid-cols-2 lg:gap-12">
      <Tabs.Content value="playing">
        {#snippet element(attributes)}
          <div {...attributes} hidden={false} class={panelClass('playing')}>
            <!-- A region of its own, as it was before the tabs: on a wide screen the tabs are not drawn. -->
            <section aria-labelledby="playing">
              <div class="flex items-baseline gap-3">
                <h2 id="playing" class="text-3xl font-semibold tracking-tight">
                  {m.dash_playing()}
                </h2>
                <span class="text-sm font-semibold text-muted">{count(data.playing.length)}</span>
              </div>
              {#if data.playing.length === 0}
                <p class="mt-3">{m.dash_playing_empty()}</p>
                <a href={localizedHref('/tables', locale)} class="mt-2 inline-block anchor">
                  {m.dash_find_table()}
                </a>
              {:else}
                <ul class="mt-5 grid gap-5">
                  {#each data.playing as item (item.slug)}
                    <li><PlayingCard {item} {next} /></li>
                  {/each}
                </ul>
              {/if}
            </section>
          </div>
        {/snippet}
      </Tabs.Content>

      <Tabs.Content value="running">
        {#snippet element(attributes)}
          <div {...attributes} hidden={false} class={panelClass('running')}>
            <!-- A region of its own, as it was before the tabs: on a wide screen the tabs are not drawn. -->
            <section aria-labelledby="running">
              <div class="flex items-baseline gap-3">
                <h2 id="running" class="text-3xl font-semibold tracking-tight">
                  {m.dash_running()}
                </h2>
                <span class="text-sm font-semibold text-muted">{count(data.running.length)}</span>
              </div>
              {#if data.running.length === 0}
                <p class="mt-3">{m.dash_running_empty()}</p>
                <a href={localizedHref('/tables/new', locale)} class="mt-2 inline-block anchor">
                  {m.tables_open_cta()}
                </a>
              {:else}
                <ul class="mt-5 grid gap-5">
                  {#each data.running as item, index (item.slug)}
                    <li><RunningCard {item} {next} openPlayers={index === 0} /></li>
                  {/each}
                </ul>
              {/if}
            </section>
          </div>
        {/snippet}
      </Tabs.Content>
    </div>
  </Tabs>
</section>
