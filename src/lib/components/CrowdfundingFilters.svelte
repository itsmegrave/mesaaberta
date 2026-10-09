<script lang="ts">
  // The list's filters: a search over the name and who is funding, and the order. The query
  // string is the contract, so a link to a filtered list keeps working. The page number is not kept:
  // a new filter starts over on the first page.
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { CROWDFUNDING_SORTS, type CrowdfundingFilters } from '$lib/crowdfunding/filters';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { picked }: { picked: Pick<CrowdfundingFilters, 'query' | 'sort' | 'ended'> } = $props();

  const locale = getLocale();
  const query = (next: typeof picked) => {
    const parts = [
      next.query ? `q=${encodeURIComponent(next.query)}` : '',
      next.sort !== 'ending' ? `sort=${next.sort}` : '',
      next.ended ? 'status=ended' : '',
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };
  const apply = (change: Partial<typeof picked>) =>
    goto(localizedHref(`/crowdfunding${query({ ...picked, ...change })}`, locale), {
      keepFocus: true,
      noScroll: true,
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
  let text = $derived(picked.query);
</script>

<div class="mt-5 grid gap-4 md:mt-8">
  <div class="flex flex-wrap items-end gap-3">
    <form
      role="search"
      class="grid w-full gap-1 md:w-80"
      onsubmit={(event) => {
        event.preventDefault();
        void apply({ query: text.trim() });
      }}
    >
      <label for="crowdfunding-search" class="label-text font-semibold"
        >{m.crowdfunding_search_label()}</label
      >
      <div class="relative">
        <Icon
          name="search"
          size={18}
          class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <TextInput
          id="crowdfunding-search"
          name="q"
          type="search"
          maxlength={100}
          placeholder={m.crowdfunding_search_placeholder()}
          bind:value={text}
          class="input h-12 w-full rounded-lg border-surface-200-800 pr-3 pl-10"
        />
      </div>
    </form>
    <div class="w-full md:w-60">
      <SearchSelect
        id="crowdfunding-sort"
        name="sort"
        label={m.crowdfunding_sort_label()}
        labelClass="label-text block pb-1 font-semibold"
        class="grid"
        compact
        items={sorts}
        value={[picked.sort]}
        placeholder={m.crowdfunding_sort_label()}
        onchange={(next) =>
          apply({
            sort: (CROWDFUNDING_SORTS as readonly string[]).includes(next[0] ?? '')
              ? (next[0] as typeof picked.sort)
              : 'ending',
          })}
      />
    </div>
  </div>
</div>
