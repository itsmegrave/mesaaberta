<script lang="ts">
  import { navigating, page } from '$app/state';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import CrowdfundingCard from '$lib/components/CrowdfundingCard.svelte';
  import CrowdfundingFilters from '$lib/components/CrowdfundingFilters.svelte';
  import CrowdfundingReportDialog from '$lib/components/CrowdfundingReportDialog.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ListSkeleton from '$lib/components/ListSkeleton.svelte';
  import Pager from '$lib/components/admin/Pager.svelte';
  import { pageHref } from '$lib/admin/page-href';
  import { localizedHref } from '$lib/i18n/locales';
  import { Slow } from '$lib/navigation/slow.svelte';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  // A filter change reloads this same page with another query: the list gives way to a skeleton
  // if it takes a while.
  const filtering = new Slow(() => {
    const to = navigating.to;
    return to?.route.id === page.route.id && to.url.search !== page.url.search ? to : null;
  }, 150);

  const locale = getLocale();
  const link = (search: string) => localizedHref(`/crowdfunding${search}`, locale);
  const anyFilter = $derived(data.filters.query !== '' || data.filters.platforms.length > 0);
  // The links between the two views and the pages keep the filters that are on.
  const keep = $derived(
    [
      data.filters.query ? `q=${encodeURIComponent(data.filters.query)}` : '',
      ...data.filters.platforms.map((platform) => `platform=${platform}`),
      data.filters.sort !== 'ending' ? `sort=${data.filters.sort}` : '',
    ].filter(Boolean),
  );
  const href = (extra: string[]) => {
    const parts = [...keep, ...extra].filter(Boolean);
    return link(parts.length > 0 ? `?${parts.join('&')}` : '');
  };

  let reporting = $state<{ id: string; name: string } | null>(null);
  const shown = $derived(
    data.filters.ended ? data.ended.length : data.running.length + data.upcoming.length,
  );
</script>

<svelte:head>
  <title>{m.crowdfunding_title()}</title>
  <meta name="description" content={m.crowdfunding_description()} />
</svelte:head>

<section class="py-2 md:pt-12">
  <Breadcrumbs class="mb-8" items={[{ label: m.nav_crowdfunding_label() }]} />
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
    <div>
      <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
        {m.crowdfunding_title()}
      </h1>
      <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
        {m.crowdfunding_lede()}
      </p>
    </div>
    <a
      href={localizedHref('/crowdfunding/new', locale)}
      class="btn h-12 shrink-0 gap-2 rounded-lg preset-filled-primary-500 px-6 font-semibold"
    >
      <Icon name="plus" size={20} />
      {m.crowdfunding_add_cta()}
    </a>
  </div>

  <CrowdfundingFilters picked={data.filters} />

  {#snippet cards(list: typeof data.running)}
    <ul class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {#each list as campaign (campaign.id)}
        <li>
          <CrowdfundingCard
            {campaign}
            onreport={campaign.canReport ? (picked) => (reporting = picked) : undefined}
          />
        </li>
      {/each}
    </ul>
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
          href={(number) => pageHref('/crowdfunding', page.url.searchParams, number, locale)}
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
    <div class="mt-10 max-w-sm" role="status">
      <p class="text-lg">
        {anyFilter ? m.crowdfunding_empty_filtered() : m.crowdfunding_empty()}
      </p>
      {#if anyFilter}
        <a href={link('')} class="mt-3 inline-block anchor">{m.crowdfunding_filter_clear()}</a>
      {/if}
    </div>
    {#if data.endedCount > 0}
      <p class="mt-4">
        <a class="anchor font-semibold" href={href(['status=ended'])}
          >{m.crowdfunding_see_ended({ count: data.endedCount })}</a
        >
      </p>
    {/if}
  {/if}
</section>

{#if reporting}
  {#key reporting.id}
    <CrowdfundingReportDialog
      campaign={reporting}
      bind:open={() => reporting !== null, (value) => !value && (reporting = null)}
    />
  {/key}
{/if}
