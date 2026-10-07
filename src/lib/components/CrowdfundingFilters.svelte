<script lang="ts">
  // The list's filters: a search over the name and who is funding, the platforms (a multi-select, as
  // on /tables) and the order. A change applies at once; the picks show as removable chips. The query
  // string is the contract, so a link to a filtered list keeps working. The page number is not kept:
  // a new filter starts over on the first page.
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { CROWDFUNDING_SORTS, type CrowdfundingFilters } from '$lib/crowdfunding/filters';
  import { platformLabel } from '$lib/crowdfunding/labels';
  import { CROWDFUNDING_PLATFORMS } from '$lib/crowdfunding/platforms';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { picked }: { picked: Pick<CrowdfundingFilters, 'query' | 'platforms' | 'sort' | 'ended'> } =
    $props();

  const locale = getLocale();
  const query = (next: typeof picked) => {
    const parts = [
      next.query ? `q=${encodeURIComponent(next.query)}` : '',
      ...next.platforms.map((platform) => `platform=${platform}`),
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

  const platforms = CROWDFUNDING_PLATFORMS.map((slug) => ({ slug, name: platformLabel(slug) }));
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
  const chips = $derived(
    picked.platforms.map((platform) => ({
      key: platform,
      name: platformLabel(platform),
      remove: () => apply({ platforms: picked.platforms.filter((value) => value !== platform) }),
    })),
  );
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
        id="crowdfunding-platforms"
        name="platform"
        label={m.crowdfunding_filter_platforms()}
        labelClass="label-text block pb-1 font-semibold"
        class="grid"
        compact
        icon="category"
        items={platforms}
        value={picked.platforms}
        placeholder={m.crowdfunding_filter_platforms()}
        multiple
        summary
        showPicks={false}
        onchange={(next) =>
          apply({
            platforms: next.filter((value) =>
              (CROWDFUNDING_PLATFORMS as readonly string[]).includes(value),
            ) as typeof picked.platforms,
          })}
      />
    </div>
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

  {#if chips.length > 0}
    <ul class="flex flex-wrap items-center gap-2" aria-label={m.crowdfunding_filters_active()}>
      {#each chips as chip (chip.key)}
        <li>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-primary-500 px-4 text-sm font-semibold hover:preset-tonal"
            aria-label={m.crowdfunding_filter_remove({ name: chip.name })}
            onclick={chip.remove}
          >
            {chip.name}<Icon name="xmark" size={16} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
