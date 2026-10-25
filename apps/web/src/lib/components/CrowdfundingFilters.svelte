<script lang="ts">
  // The list's filters: a search over the name and who is funding, and the order. The query
  // string is the contract, so a link to a filtered list keeps working. The page number is not kept:
  // a new filter starts over on the first page.
  import { goto } from '$app/navigation';
  import SearchSortFilters from '#lib/components/SearchSortFilters.svelte';
  import {
    CROWDFUNDING_SORTS,
    type CrowdfundingFilters,
  } from '@mesaaberta/core/crowdfunding/filters';
  import { m } from '#lib/paraglide/messages.js';

  let { picked }: { picked: Pick<CrowdfundingFilters, 'query' | 'sort' | 'ended'> } = $props();

  const query = (next: typeof picked) => {
    const parts = [
      next.query ? `q=${encodeURIComponent(next.query)}` : '',
      next.sort !== 'ending' ? `sort=${next.sort}` : '',
      next.ended ? 'status=ended' : '',
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };
  const apply = (change: Partial<typeof picked>) =>
    goto(`/cf${query({ ...picked, ...change })}`, {
      reset: false,
    });

  const sorts = $derived(
    CROWDFUNDING_SORTS.map((slug) => ({
      slug,
      name: {
        ending: m.crowdfunding_sort_ending,
        newest: m.crowdfunding_sort_newest,
        name: m.crowdfunding_sort_name,
      }[slug](),
    })),
  );
</script>

<div class="mt-5 grid gap-4 md:mt-8">
  <SearchSortFilters
    id="crowdfunding"
    query={picked.query}
    sort={picked.sort}
    {sorts}
    fallback="ending"
    searchLabel={m.crowdfunding_search_label()}
    searchPlaceholder={m.crowdfunding_search_placeholder()}
    sortLabel={m.crowdfunding_sort_label()}
    onapply={(change) => void apply(change)}
  />
</div>
