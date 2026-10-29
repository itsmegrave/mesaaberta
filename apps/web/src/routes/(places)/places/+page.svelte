<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import DirectoryFilters from '#lib/components/directory/DirectoryFilters.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { legacyTagOptions, placeKindOptions } from '#lib/places/labels.js';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import {
    NO_FILTERS,
    PLACE_SORTS,
    placeDirectoryQuery,
    type PlaceFilters,
  } from '@mesaaberta/core/places/filters';
  import { isPlaceKind } from '@mesaaberta/core/places/types';
  import PlaceCard from './components/ui/PlaceCard.svelte';

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
  const apply = (change: Partial<Omit<PlaceFilters, 'page'>>) =>
    goto(`/places${placeDirectoryQuery({ ...filters, ...change })}`, { reset: false });
  const toggle = (slug: string) =>
    apply({
      tags: filters.tags.includes(slug)
        ? filters.tags.filter((picked) => picked !== slug)
        : [...filters.tags, slug],
    });

  const sorts = $derived(
    PLACE_SORTS.map((slug) => ({
      slug,
      name: {
        open: m.places_sort_open,
        recent: m.places_sort_recent,
        name: m.places_sort_name,
      }[slug](),
    })),
  );
  // "Todos" is the pick for no filter in each select.
  const ANY = 'all';
  const stateItems = $derived([
    { slug: ANY, name: m.places_state_any() },
    ...data.states.map((tag) => ({ slug: tag.slug, name: tag.label })),
  ]);
  const cityItems = $derived([
    { slug: ANY, name: m.places_city_any() },
    ...data.cities.map((tag) => ({ slug: tag.slug, name: tag.label })),
  ]);
  const kindItems = $derived([
    { slug: ANY, name: m.places_kind_any() },
    ...placeKindOptions().map(({ value, label }) => ({ slug: value, name: label })),
  ]);
  const filtered = $derived(
    !!(filters.query || filters.state || filters.kind || filters.tags.length > 0),
  );
  const steps = $derived([
    { title: m.places_step_1_title(), text: m.places_step_1() },
    { title: m.places_step_2_title(), text: m.places_step_2() },
    { title: m.places_step_3_title(), text: m.places_step_3() },
  ]);
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <PageHead crumbs={[{ label: m.places_crumb() }]} title={m.places_title()} lede={m.places_lede()}>
    {#snippet actions()}
      <a href="/pp/new" class="{buttonClass('primary')} shrink-0 gap-2 px-6 font-semibold">
        <Icon name="game-icons:position-marker" size={20} />
        {m.places_cta()}
      </a>
    {/snippet}
  </PageHead>

  <section aria-labelledby="places-how" class="mt-8">
    <h2 id="places-how" class="sr-only">{m.places_how_title()}</h2>
    <ol class="grid gap-3 md:grid-cols-3 md:gap-6">
      {#each steps as step, index (step.title)}
        <li class="flex gap-4 rounded-lg bg-surface-wash p-4 md:p-5">
          <span
            aria-hidden="true"
            class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-sm font-bold"
            >{index + 1}</span
          >
          <div>
            <p class="font-semibold">{step.title}</p>
            <p class="mt-0.5 text-sm text-muted">{step.text}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <DirectoryFilters
    id="places"
    query={filters.query}
    searchLabel={m.places_search_label()}
    sort={{ label: m.directory_sort_label(), value: filters.sort, options: sorts }}
    result={m.places_found({ count: data.total })}
    onapply={(change) => void apply(change)}
  >
    {#snippet controls()}
      <SearchSelect
        id="places-state"
        name="state"
        label={m.places_state_label()}
        labelClass="sr-only"
        class="w-full md:w-48"
        compact
        items={stateItems}
        value={[filters.state || ANY]}
        placeholder={m.places_state_label()}
        onchange={(next) => {
          const slug = next[0] ?? ANY;
          void apply({ state: slug === ANY ? '' : slug, city: '' });
        }}
      />
      {#if filters.state}
        <SearchSelect
          id="places-city"
          name="city"
          label={m.places_city_label()}
          labelClass="sr-only"
          class="w-full md:w-56"
          compact
          items={cityItems}
          value={[filters.city || ANY]}
          placeholder={m.places_city_label()}
          onchange={(next) => {
            const slug = next[0] ?? ANY;
            void apply({ city: slug === ANY ? '' : slug });
          }}
        />
      {/if}
      <SearchSelect
        id="places-kind"
        name="kind"
        label={m.places_kind_label()}
        labelClass="sr-only"
        class="w-full md:w-60"
        compact
        items={kindItems}
        value={[filters.kind || ANY]}
        placeholder={m.places_kind_label()}
        onchange={(next) => {
          const kind = next[0] ?? ANY;
          void apply({ kind: isPlaceKind(kind) ? kind : '' });
        }}
      />
      {#if data.placeTags}
        <SearchSelect
          id="places-tags"
          name="tag"
          label={m.places_amenities_label()}
          labelClass="sr-only"
          class="w-full md:w-72"
          compact
          search
          multiple
          summary
          items={data.tags}
          value={filters.tags}
          placeholder={m.places_amenities_label()}
          onchange={(next) => void apply({ tags: next })}
        />
      {/if}
      <div
        role="group"
        aria-label={m.places_amenities_label()}
        class="flex w-full flex-wrap items-center gap-2"
      >
        {#if !data.placeTags}
          <span class="text-sm font-semibold text-muted">{m.places_amenities_label()}</span>
          {#each legacyTagOptions() as option (option.slug)}
            {@const on = filters.tags.includes(option.slug)}
            <MAButton
              size="custom"
              aria-pressed={on}
              class="chip h-8 rounded-full border px-3 text-sm font-semibold {on
                ? 'border-transparent preset-filled-primary-500'
                : 'border-surface-200-800'}"
              onclick={() => void toggle(option.slug)}>{option.name}</MAButton
            >
          {/each}
        {/if}
        {#if filtered}
          <a
            href="/places"
            class="ml-1 text-sm font-semibold text-link underline underline-offset-4"
            >{m.places_clear_filters()}</a
          >
        {/if}
      </div>
    {/snippet}
  </DirectoryFilters>

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.places.length > 0}
    <CardGrid>
      {#each data.places as place (place.slug)}
        <li class="min-w-0"><PlaceCard {place} /></li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={filters.page}
        pages={data.pages}
        compact
        href={(number) => `/places${placeDirectoryQuery(filters, number)}`}
      />
    </div>
  {:else if filtered}
    <DirectoryEmpty
      class="mt-2"
      title={m.places_empty_filtered()}
      hint={m.places_empty_filtered_hint()}
      href={`/places${placeDirectoryQuery(NO_FILTERS)}`}
      action={m.places_clear_filters()}
    />
  {:else}
    <DirectoryEmpty
      class="mt-2"
      title={m.places_empty()}
      hint={m.places_empty_hint()}
      href="/pp/new"
      action={m.places_cta()}
    />
  {/if}

  <aside
    aria-labelledby="places-missing"
    class="mt-12 flex flex-col items-start gap-4 rounded-lg border border-surface-200-800 bg-panel p-6 md:flex-row md:items-center md:justify-between md:p-8"
  >
    <div>
      <h2 id="places-missing" class="text-xl font-semibold tracking-tight">
        {m.places_missing_title()}
      </h2>
      <p class="mt-1 text-muted">{m.places_missing_text()}</p>
    </div>
    <a href="/pp/new" class="{buttonClass('secondary')} shrink-0 px-6 font-semibold"
      >{m.places_cta()}</a
    >
  </aside>
</section>
