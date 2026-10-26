<script lang="ts">
  import Icon from '#lib/components/ui/Icon.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import { navigating, page } from '$app/state';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import TablesFilters from '../components/TablesFilters.svelte';
  import TableCard from '#lib/components/ui/TableCard.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while. Coming back to the same query (after marking read, say) keeps the list.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const listHref = '/tables';

  const count = $derived(data.tables.length);
  const anyFilter = $derived(
    data.pickedSystems.length > 0 ||
      data.pickedPlatforms.length > 0 ||
      data.pickedTags.length > 0 ||
      !!data.modality,
  );
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <PageHead crumbs={[{ label: m.nav_tables() }]} title={m.tables_title()} lede={m.tables_lede()}>
    {#snippet actions()}
      <!-- On a phone the bottom tab bar already offers this action. -->
      <a
        href="/tables/new"
        class="btn hidden h-12 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold md:inline-flex"
      >
        <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />
        {m.tables_open_cta()}
      </a>
    {/snippet}
  </PageHead>

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
    <CardGrid class="mt-5 md:mt-3">
      {#each data.tables as table (table.slug)}
        <li><TableCard {table} level="h2" /></li>
      {/each}
    </CardGrid>
  {:else}
    <EmptyState
      text={anyFilter ? m.tables_empty_filtered() : m.tables_empty()}
      clearHref={anyFilter ? listHref : undefined}
      clearLabel={m.tables_filter_clear()}
    />
  {/if}
</section>
