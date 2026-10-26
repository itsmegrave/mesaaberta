<script lang="ts" generics="Sort extends string">
  // A list's search and order (Parceiros, Financiamentos). The search applies when it is sent
  // (Enter), the order as soon as it is picked; an order that is not one of `sorts` falls back to
  // `fallback`. The caller turns the change into the list's address. `children` holds the list's own
  // filters, drawn between the search and the order (the partners' "Tipo").
  import type { Snippet } from 'svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';

  let {
    id,
    query,
    sort,
    sorts,
    fallback,
    searchLabel,
    searchPlaceholder,
    sortLabel,
    onapply,
    class: className = '',
    children,
  }: {
    /** Prefix of the fields' ids: `{id}-search` and `{id}-sort`. */
    id: string;
    query: string;
    sort: Sort;
    sorts: readonly { slug: Sort; name: string }[];
    fallback: Sort;
    searchLabel: string;
    searchPlaceholder: string;
    sortLabel: string;
    onapply: (change: { query?: string; sort?: Sort }) => void;
    class?: string;
    children?: Snippet;
  } = $props();

  let text = $derived(query);
  const known = (value: string | undefined): value is Sort =>
    sorts.some((item) => item.slug === value);
</script>

<div class="{className} flex flex-wrap items-end gap-3">
  <form
    role="search"
    class="grid w-full gap-1 md:w-80"
    onsubmit={(event) => {
      event.preventDefault();
      onapply({ query: text.trim() });
    }}
  >
    <label for="{id}-search" class="label-text font-semibold">{searchLabel}</label>
    <div class="relative">
      <Icon
        name="search"
        size={18}
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <TextInput
        id="{id}-search"
        name="q"
        type="search"
        maxlength={100}
        placeholder={searchPlaceholder}
        bind:value={text}
        class="input h-12 w-full rounded-lg border-surface-200-800 pr-3 pl-10"
      />
    </div>
  </form>
  {@render children?.()}
  <div class="w-full md:w-60">
    <SearchSelect
      id="{id}-sort"
      name="sort"
      label={sortLabel}
      labelClass="label-text block pb-1 font-semibold"
      class="grid"
      compact
      items={[...sorts]}
      value={[sort]}
      placeholder={sortLabel}
      onchange={(next) => onapply({ sort: known(next[0]) ? next[0] : fallback })}
    />
  </div>
</div>
