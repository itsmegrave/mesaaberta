<script lang="ts">
  import { goto } from '$app/navigation';
  import { navigating, page } from '$app/state';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import DirectoryEmpty from '#lib/components/directory/ui/DirectoryEmpty.svelte';
  import DirectoryFilters from '#lib/components/directory/DirectoryFilters.svelte';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import {
    GM_SORTS,
    gmDirectoryQuery,
    type GmDirectoryFilters,
    type GmModality,
  } from '@mesaaberta/core/gms/directory-filters';
  import GmCard from './components/ui/GmCard.svelte';
  import { gmFacts } from './components/gm-card';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const filters = $derived(data.filters);
  const now = new Date();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  // A new filter starts over on the first page.
  const apply = (change: Partial<Omit<GmDirectoryFilters, 'page'>>) =>
    goto(`/gamemasters${gmDirectoryQuery({ ...filters, ...change })}`, { reset: false });

  const sorts = $derived(
    GM_SORTS.map((slug) => ({
      slug,
      name: {
        recent: m.gms_sort_recent,
        score: m.gms_sort_score,
        tables: m.gms_sort_tables,
        name: m.gms_sort_name,
      }[slug](),
    })),
  );
  // "Todas" is the pill for no modality.
  type ModalityPill = GmModality | 'all';
  const modalities = $derived([
    { value: 'all' as ModalityPill, label: m.gms_modality_all() },
    { value: 'online' as ModalityPill, label: m.gms_modality_online() },
    { value: 'in_person' as ModalityPill, label: m.gms_modality_in_person() },
  ]);
  const ANY_SYSTEM = 'all';
  const systemItems = $derived([
    { slug: ANY_SYSTEM, name: m.gms_system_any() },
    ...data.systems.map((system) => ({ slug: system.slug, name: system.name })),
  ]);
  const filtered = $derived(
    !!(filters.query || filters.system || filters.modality || filters.open),
  );
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

<section class="py-2 md:pt-12">
  <PageHead crumbs={[{ label: m.gms_crumb() }]} title={m.gms_title()} lede={m.gms_lede()}>
    {#snippet actions()}
      <a href="/u/profile/edit" class="{buttonClass('secondary')} shrink-0 gap-2 px-6 font-semibold">
        <Icon name="game-icons:pointy-hat" size={20} />
        {m.gms_cta()}
      </a>
    {/snippet}
  </PageHead>

  <DirectoryFilters
    id="gms"
    query={filters.query}
    searchLabel={m.gms_search_label()}
    show={{
      legend: m.gms_modality_label(),
      value: (filters.modality || 'all') as ModalityPill,
      options: modalities,
    }}
    sort={{ label: m.directory_sort_label(), value: filters.sort, options: sorts }}
    result={m.gms_found({ count: data.total })}
    note={m.gms_found_hint()}
    onapply={({ show, ...change }) =>
      void apply(show ? { ...change, modality: show === 'all' ? '' : show } : change)}
  >
    {#snippet controls()}
      <SearchSelect
        id="gms-system"
        name="system"
        label={m.gms_system_label()}
        labelClass="sr-only"
        class="w-full md:w-60"
        compact
        items={systemItems}
        value={[filters.system || ANY_SYSTEM]}
        placeholder={m.gms_system_label()}
        onchange={(next) => {
          const slug = next[0] ?? ANY_SYSTEM;
          void apply({ system: slug === ANY_SYSTEM ? '' : slug });
        }}
      />
      <Switch
        checked={filters.open}
        onCheckedChange={(event) => void apply({ open: event.checked })}
        class="flex min-h-11 items-center gap-3"
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label class="text-sm font-semibold">{m.gms_open_only()}</Switch.Label>
        <Switch.HiddenInput />
      </Switch>
    {/snippet}
  </DirectoryFilters>

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.people.length > 0}
    <CardGrid>
      {#each data.people as gm (gm.username)}
        <li class="min-w-0">
          <GmCard {gm} facts={gmFacts(gm, now)} />
        </li>
      {/each}
    </CardGrid>
    <div class="mt-8">
      <Pager
        page={filters.page}
        pages={data.pages}
        compact
        href={(number) => `/gamemasters${gmDirectoryQuery(filters, number)}`}
      />
    </div>
  {:else if filtered}
    <DirectoryEmpty
      class="mt-2"
      title={m.gms_empty_filtered()}
      hint={m.gms_empty_filtered_hint()}
      href="/gamemasters"
      action={m.gms_clear_filters()}
    />
  {:else}
    <DirectoryEmpty
      class="mt-2"
      title={m.gms_empty()}
      hint={m.gms_empty_hint()}
      href="/u/profile/edit"
      action={m.gms_empty_action()}
    />
  {/if}
</section>
