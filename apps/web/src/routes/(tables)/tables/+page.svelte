<script lang="ts">
  import Icon from '#lib/components/ui/Icon.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import MAAccordion from '#lib/components/ui/MAAccordion.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import { navigating, page } from '$app/state';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import TablesFilters from '../components/TablesFilters.svelte';
  import TableCardSection from '../components/TableCardSection.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { STARTING_SOON_HOURS } from '#lib/tables/starting-soon.js';

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
  // Both sections start open; each folds on its own.
  let open = $state(['starting-soon', 'all']);

  const count = $derived(data.tables.length);
  // The same filters with the 18+ tables shown or hidden again.
  const adultHref = $derived.by(() => {
    const query = new SvelteURLSearchParams(page.url.search);
    if (data.adult.shown) query.delete('adult');
    else query.set('adult', '1');
    const search = query.toString();
    return search ? `${listHref}?${search}` : listHref;
  });
  const anyFilter = $derived(
    data.pickedSystems.length > 0 ||
      data.pickedPlatforms.length > 0 ||
      data.pickedTags.length > 0 ||
      !!data.modality ||
      !!data.pickedGm,
  );
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-8">
  <PageHead crumbs={[{ label: m.nav_tables() }]} title={m.tables_title()} lede={m.tables_lede()}>
    {#snippet actions()}
      <!-- On a phone the bottom tab bar already offers this action. -->
      <a
        href="/tables/new"
        class="btn hidden h-11 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold md:inline-flex"
      >
        <Icon name="game-icons:dice-twenty-faces-twenty" size={20} />
        {m.tables_open_cta()}
      </a>
    {/snippet}
  </PageHead>
  {#if page.data.beginners}
    <p class="mt-3 text-sm">
      <a href="/beginners" class="font-semibold underline underline-offset-4"
        >{m.beginners_tables_link()}</a
      >
    </p>
  {/if}

  <TablesFilters
    systems={data.systems}
    catalog={data.catalog}
    picked={{
      systems: data.pickedSystems,
      modality: data.modality,
      platforms: data.pickedPlatforms,
      tags: data.pickedTags,
      gm: data.pickedGm,
    }}
    {count}
  />

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else}
    {#if data.tables.length > 0}
      <p role="status" class="sr-only">{m.tables_found({ count })}</p>
    {/if}
    {#if data.tables.length > 0 && data.adult.count > 0}
      <p class="mt-6 text-sm text-muted">
        {data.adult.shown
          ? m.tables_adult_shown({ count: data.adult.count })
          : m.tables_adult_hidden({ count: data.adult.count })}
        <a href={adultHref} class="font-semibold text-link underline underline-offset-4"
          >{data.adult.shown ? m.tables_adult_hide() : m.tables_adult_show()}</a
        >
      </p>
    {/if}
    {#if data.startingSoon?.length || data.tables.length > 0}
      <MAAccordion bind:value={open} class="mt-4">
        {#if data.startingSoon?.length}
          <TableCardSection
            value="starting-soon"
            icon="game-icons:hourglass"
            title={m.tables_starting_soon()}
            summary={m.tables_starting_soon_hint({ hours: STARTING_SOON_HOURS })}
            tables={data.startingSoon}
          />
        {/if}
        {#if data.tables.length > 0}
          <TableCardSection
            value="all"
            title={m.tables_all_title()}
            summary={m.tables_found({ count })}
            tables={data.tables}
            limit={Infinity}
          />
        {/if}
      </MAAccordion>
    {/if}
  {/if}
  {#if !filtering.current && data.tables.length === 0}
    <EmptyState
      text={anyFilter ? m.tables_empty_filtered() : m.tables_empty()}
      clearHref={anyFilter ? listHref : undefined}
      clearLabel={m.tables_filter_clear()}
    />
  {/if}
</section>
