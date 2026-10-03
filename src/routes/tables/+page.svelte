<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import { navigating, page } from '$app/state';
  import ListSkeleton from '$lib/components/ListSkeleton.svelte';
  import { Slow } from '$lib/navigation/slow.svelte';
  import TablesFilters from '$lib/components/TablesFilters.svelte';
  import TableCard from '$lib/components/TableCard.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while. Coming back to the same query (after marking read, say) keeps the list.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const locale = getLocale();
  const listHref = localizedHref('/tables', locale);

  const count = $derived(data.tables.length);
  const anyFilter = $derived(
    data.pickedSystems.length > 0 ||
      data.pickedPlatforms.length > 0 ||
      data.pickedTags.length > 0 ||
      !!data.modality,
  );
</script>

<svelte:head>
  <title>{m.tables_title()}</title>
  <meta name="description" content={m.tables_description()} />
</svelte:head>
<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <Breadcrumbs class="mb-8" items={[{ label: m.nav_tables() }]} />
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
    <div>
      <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
        {m.tables_title()}
      </h1>
      <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
        {m.tables_lede()}
      </p>
    </div>
    <!-- On a phone the tab bar offers this once the platform is released; until then, the page does. -->
    <a
      href={localizedHref('/tables/new', locale)}
      class="btn h-12 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold md:inline-flex {data.released
        ? 'hidden'
        : 'inline-flex'}"
    >
      <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />
      {m.tables_open_cta()}
    </a>
  </div>

  <TablesFilters
    systems={data.systems}
    catalog={data.catalog}
    picked={{
      systems: data.pickedSystems,
      modality: data.modality,
      platforms: data.pickedPlatforms,
      tags: data.pickedTags,
    }}
    {count}
  />

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.tables.length > 0}
    <p role="status" class="mt-6 text-sm font-semibold text-muted">
      {m.tables_found({ count })}
    </p>
    <ul class="mt-5 grid grid-cols-1 gap-4 md:mt-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {#each data.tables as table (table.slug)}
        <li><TableCard {table} /></li>
      {/each}
    </ul>
  {:else}
    <div class="mt-10 max-w-sm" role="status">
      <p class="text-lg">
        {anyFilter ? m.tables_empty_filtered() : m.tables_empty()}
      </p>
      {#if anyFilter}
        <a href={listHref} class="mt-3 inline-block anchor">{m.tables_filter_clear()}</a>
      {/if}
    </div>
  {/if}
</section>
