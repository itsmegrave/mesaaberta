<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import AvatarStack from '#lib/components/directory/ui/AvatarStack.svelte';
  import DirectoryCard from '#lib/components/directory/ui/DirectoryCard.svelte';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import DirectoryFilters from '#lib/components/directory/DirectoryFilters.svelte';
  import DirectoryMark from '#lib/components/directory/ui/DirectoryMark.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import {
    SYSTEM_SORTS,
    systemDirectoryQuery,
    type SystemShow,
    type SystemSort,
  } from '@mesaaberta/core/systems/directory-filters';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const filters = $derived(data.filters);

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  // A new filter starts over on the first page.
  const apply = (change: { query?: string; show?: SystemShow; sort?: SystemSort }) =>
    goto(`/systems${systemDirectoryQuery({ ...filters, ...change })}`, { reset: false });

  const sorts = $derived(
    SYSTEM_SORTS.map((slug) => ({
      slug,
      name: {
        open: m.systems_sort_open,
        played: m.systems_sort_played,
        az: m.systems_sort_az,
      }[slug](),
    })),
  );
  const result = $derived(
    filters.show === 'open'
      ? m.systems_found_open({ count: data.total })
      : m.systems_found_all({ count: data.total }),
  );
  const facts = (system: { totalTables: number; gmCount: number }) =>
    system.totalTables === 0
      ? m.systems_never_played()
      : `${m.systems_tables_here({ count: system.totalTables })} · ${m.systems_gm_count({ count: system.gmCount })}`;
  const status = (system: { openTables: number; totalTables: number }) =>
    system.openTables > 0
      ? m.directory_open_tables({ count: system.openTables })
      : system.totalTables === 0
        ? m.systems_first_gm()
        : m.systems_none_open();
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.systems_crumb() }]}
    title={m.systems_title()}
    lede={m.systems_lede()}
  >
    {#snippet actions()}
      <a href="/tables/new" class="{buttonClass('primary')} shrink-0 gap-2 px-6 font-semibold">
        <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />
        {m.systems_open_cta()}
      </a>
    {/snippet}
  </PageHead>

  <DirectoryFilters
    id="systems"
    query={filters.query}
    searchLabel={m.systems_search_label()}
    show={{
      legend: m.directory_show_label(),
      value: filters.show,
      options: [
        { value: 'open', label: m.systems_show_open() },
        { value: 'all', label: m.systems_show_all() },
      ],
    }}
    sort={{ label: m.directory_sort_label(), value: filters.sort, options: sorts }}
    {result}
    onapply={(change) => void apply(change)}
  />

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.systems.length > 0}
    <CardGrid>
      {#each data.systems as system (system.slug)}
        <li class="min-w-0">
          <DirectoryCard
            href="/s/{system.slug}"
            name={system.name}
            facts={facts(system)}
            status={status(system)}
            active={system.openTables > 0}
          >
            {#snippet mark()}<DirectoryMark name={system.name} />{/snippet}
            {#snippet people()}
              <AvatarStack
                people={system.gms}
                total={system.gmCount}
                label={m.directory_gms_label()}
              />
            {/snippet}
          </DirectoryCard>
        </li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={filters.page}
        pages={data.pages}
        compact
        href={(number) => `/systems${systemDirectoryQuery(filters, number)}`}
      />
    </div>
  {:else if filters.query}
    <DirectoryEmpty
      class="mt-2"
      title={m.systems_empty_search({ query: filters.query })}
      hint={m.systems_empty_hint()}
      href="/tables/new"
      action={m.systems_open_cta()}
    />
  {:else}
    <DirectoryEmpty
      class="mt-2"
      title={m.systems_empty_open()}
      href={`/systems${systemDirectoryQuery({ ...filters, show: 'all' })}`}
      action={m.systems_show_all_link()}
    />
  {/if}
</section>
