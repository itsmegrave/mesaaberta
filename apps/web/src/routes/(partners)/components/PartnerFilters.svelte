<script lang="ts">
  // The list's filters: a search over the name and the description, one kind ("Tipo") and the order.
  // A change applies at once. The query string is the contract, so a link to a filtered list keeps
  // working. The page number is not kept: a new filter starts over on the first page.
  import { goto } from '$app/navigation';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import SearchSortFilters from '#lib/components/ui/SearchSortFilters.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { partnerTypeOptions } from '#lib/partners/type-labels.js';

  import { PARTNER_SORTS, type PartnerFilters } from '@mesaaberta/core/partners/filters';
  import { isPartnerType } from '@mesaaberta/core/partners/types';

  let { picked }: { picked: Pick<PartnerFilters, 'query' | 'type' | 'sort'> } = $props();

  const query = (next: typeof picked) => {
    const parts = [
      next.query ? `q=${encodeURIComponent(next.query)}` : '',
      next.type ? `type=${next.type}` : '',
      next.sort !== 'newest' ? `sort=${next.sort}` : '',
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };
  const apply = (change: Partial<typeof picked>) =>
    goto(`/partners${query({ ...picked, ...change })}`, {
      reset: false,
    });

  const sorts = $derived(
    PARTNER_SORTS.map((slug) => ({
      slug,
      name: { newest: m.partner_sort_newest, name: m.partner_sort_name }[slug](),
    })),
  );
  // "Todos os tipos" first: picking it drops the filter.
  const ALL = 'all';
  const types = $derived([
    { slug: ALL, name: m.partner_type_all() },
    ...partnerTypeOptions().map(({ value, label }) => ({ slug: value, name: label })),
  ]);
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
>
  <div class="w-full md:w-60">
    <SearchSelect
      id="partner-type"
      name="type"
      label={m.partner_type_filter()}
      labelClass="label-text block pb-1 font-semibold"
      class="grid"
      compact
      items={types}
      value={[picked.type ?? ALL]}
      placeholder={m.partner_type_all()}
      onchange={(next) => void apply({ type: isPartnerType(next[0]) ? next[0] : null })}
    />
  </div>
</SearchSortFilters>
