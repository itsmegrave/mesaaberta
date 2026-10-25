<script lang="ts">
  // The list's filters: a search over the name and the description, and the order. A change applies
  // at once. The query string is the contract, so a link to a filtered list keeps working. The page
  // number is not kept: a new filter starts over on the first page.
  import { goto } from '$app/navigation';
  import SearchSortFilters from '#lib/components/SearchSortFilters.svelte';
  import { m } from '#lib/paraglide/messages.js';

  import { PARTNER_SORTS, type PartnerFilters } from '@mesaaberta/core/partners/filters';

  let { picked }: { picked: Pick<PartnerFilters, 'query' | 'sort'> } = $props();

  const query = (next: typeof picked) => {
    const parts = [
      next.query ? `q=${encodeURIComponent(next.query)}` : '',
      next.sort !== 'newest' ? `sort=${next.sort}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };
  const apply = (change: Partial<typeof picked>) =>
    goto(`/p${query({ ...picked, ...change })}`, {
      reset: false,
    });

  const sorts = $derived(
    PARTNER_SORTS.map((slug) => ({
      slug,
      name: { newest: m.partner_sort_newest, name: m.partner_sort_name }[slug](),
    })),
  );
</script>

<SearchSortFilters
  id="partner"
  class="mt-5 md:mt-8"
  query={picked.query}
  sort={picked.sort}
  {sorts}
  fallback="newest"
  searchLabel={m.partner_search_label()}
  searchPlaceholder={m.partner_search_placeholder()}
  sortLabel={m.partner_sort_label()}
  onapply={(change) => void apply(change)}
/>
