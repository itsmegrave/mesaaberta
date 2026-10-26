<script lang="ts" generics="Show extends string, Sort extends string">
  // A directory's filters, on one 44px line from `md` (stacked on a phone): the search, sent with
  // Enter, and up to one choice of a few pills, applied when picked; then the result line, with the
  // count announced on the left and "Ordenar" on the right. No visible labels on the first line:
  // each control carries its own. The caller turns a change into the list's address.
  import Icon from '#lib/components/ui/Icon.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import SegmentedChoice from '#lib/components/ui/SegmentedChoice.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';

  let {
    id,
    query,
    searchLabel,
    show,
    sort,
    result,
    onapply,
  }: {
    /** Prefix of the fields' ids. */
    id: string;
    query: string;
    searchLabel: string;
    show?: { legend: string; value: Show; options: readonly { value: Show; label: string }[] };
    sort: { label: string; value: Sort; options: readonly { slug: Sort; name: string }[] };
    /** The count line ("48 sistemas com mesa aberta"). */
    result: string;
    onapply: (change: { query?: string; show?: Show; sort?: Sort }) => void;
  } = $props();

  let text = $derived(query);
  const knownSort = (value: string | undefined): value is Sort =>
    sort.options.some((option) => option.slug === value);
</script>

<div class="mt-6 flex flex-col gap-3 md:mt-8 md:flex-row md:items-center">
  <form
    role="search"
    class="relative w-full md:w-85"
    onsubmit={(event) => {
      event.preventDefault();
      onapply({ query: text.trim() });
    }}
  >
    <Icon
      name="search"
      size={16}
      class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted"
    />
    <TextInput
      id="{id}-search"
      name="q"
      type="search"
      maxlength={100}
      aria-label={searchLabel}
      placeholder={searchLabel}
      bind:value={text}
      class="input h-11 w-full rounded-lg border-control border-surface-200-800 pr-3 pl-10 text-sm"
    />
  </form>
  {#if show}
    <SegmentedChoice
      id="{id}-show"
      name="show"
      legend={show.legend}
      legendClass="sr-only"
      class=""
      options={show.options}
      value={show.value}
      onchange={(value) => onapply({ show: value })}
    />
  {/if}
</div>

<div class="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
  <p role="status" class="text-sm font-semibold text-muted">{result}</p>
  <SearchSelect
    id="{id}-sort"
    name="sort"
    label={sort.label}
    labelClass="text-sm font-semibold text-muted"
    class="flex w-full items-center gap-2 sm:w-72 md:w-auto"
    controlClass="md:w-85"
    compact
    active={false}
    items={[...sort.options]}
    value={[sort.value]}
    placeholder={sort.label}
    onchange={(next) => {
      if (knownSort(next[0])) onapply({ sort: next[0] });
    }}
  />
</div>
