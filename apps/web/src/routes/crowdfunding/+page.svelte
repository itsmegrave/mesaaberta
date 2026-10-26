<script lang="ts">
  import { navigating, page } from '$app/state';
  import CardGrid from '#lib/components/ui/CardGrid.svelte';
  import EmptyState from '#lib/components/ui/EmptyState.svelte';
  import PageHead from '#lib/components/ui/PageHead.svelte';
  import CrowdfundingCard from './components/ui/CrowdfundingCard.svelte';
  import CrowdfundingFilters from './components/CrowdfundingFilters.svelte';
  import EntityReportDialog from '#lib/components/report/EntityReportDialog.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import Pager from '#lib/components/ui/Pager.svelte';
  import { pageHref } from '#lib/admin/page-href.js';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { Target } from '#lib/target.svelte.js';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const link = (search: string) => `/crowdfunding${search}`;
  const anyFilter = $derived(data.filters.query !== '');
  // The links between the two views and the pages keep the filters that are on.
  const keep = $derived(
    [
      data.filters.query ? `q=${encodeURIComponent(data.filters.query)}` : '',
      data.filters.sort !== 'ending' ? `sort=${data.filters.sort}` : '',
    ].filter(Boolean),
  );
  const href = (extra: string[]) => {
    const parts = [...keep, ...extra].filter(Boolean);
    return link(parts.length > 0 ? `?${parts.join('&')}` : '');
  };

  const reporting = new Target<{ id: string; name: string }>();
  const shown = $derived(
    data.filters.ended ? data.ended.length : data.running.length + data.upcoming.length,
  );
</script>

<section class="py-2 md:pt-12">
  <PageHead
    crumbs={[{ label: m.nav_crowdfunding_label() }]}
    title={m.crowdfunding_title()}
    lede={m.crowdfunding_lede()}
  >
    {#snippet actions()}
      <a
        href="/crowdfunding/new"
        class="btn h-12 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
      >
        <Icon name="plus" size={20} />
        {m.crowdfunding_add_cta()}
      </a>
    {/snippet}
  </PageHead>

  <CrowdfundingFilters picked={data.filters} />

  {#snippet cards(list: typeof data.running)}
    <CardGrid class="mt-4">
      {#each list as campaign (campaign.id)}
        <li>
          <CrowdfundingCard
            {campaign}
            onreport={campaign.canReport ? (picked) => (reporting.current = picked) : undefined}
          />
        </li>
      {/each}
    </CardGrid>
  {/snippet}

  {#if filtering.current}
    <ListSkeleton kind="cards" />
  {:else if data.filters.ended}
    <div class="mt-8 flex flex-wrap items-baseline justify-between gap-3">
      <h2 class="text-2xl font-semibold tracking-tight">{m.crowdfunding_section_ended()}</h2>
      <a class="anchor font-semibold" href={href([])}>{m.crowdfunding_see_running()}</a>
    </div>
    {#if data.ended.length > 0}
      {@render cards(data.ended)}
      <div class="mt-8">
        <Pager
          page={data.filters.page}
          pages={data.pages}
          href={(number) =>
            pageHref(
              '/crowdfunding',
              new URLSearchParams([...keep, 'status=ended'].join('&')),
              number,
            )}
        />
      </div>
    {:else}
      <p role="status" class="mt-6 text-lg">
        {anyFilter ? m.crowdfunding_empty_filtered() : m.crowdfunding_empty()}
      </p>
    {/if}
  {:else if shown > 0}
    {#if data.running.length > 0}
      <h2 class="mt-8 text-2xl font-semibold tracking-tight">{m.crowdfunding_section_running()}</h2>
      {@render cards(data.running)}
    {/if}
    {#if data.upcoming.length > 0}
      <h2 class="mt-10 text-2xl font-semibold tracking-tight">
        {m.crowdfunding_section_upcoming()}
      </h2>
      {@render cards(data.upcoming)}
    {/if}
    {#if data.endedCount > 0}
      <p class="mt-8">
        <a class="anchor font-semibold" href={href(['status=ended'])}
          >{m.crowdfunding_see_ended({ count: data.endedCount })}</a
        >
      </p>
    {/if}
  {:else}
    <EmptyState
      text={anyFilter ? m.crowdfunding_empty_filtered() : m.crowdfunding_empty()}
      clearHref={anyFilter ? link('') : undefined}
      clearLabel={m.crowdfunding_filter_clear()}
    />
    {#if data.endedCount > 0}
      <p class="mt-4">
        <a class="anchor font-semibold" href={href(['status=ended'])}
          >{m.crowdfunding_see_ended({ count: data.endedCount })}</a
        >
      </p>
    {/if}
  {/if}
</section>

{#if reporting.current}
  {#key reporting.current.id}
    <EntityReportDialog kind="crowdfunding" entity={reporting.current} bind:open={reporting.open} />
  {/key}
{/if}
