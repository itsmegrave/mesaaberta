<script lang="ts" generics="Sort extends string">
  // A list's search and order (Parceiros, Financiamentos), on one 44px line from `md` like the
  // directories' filters: no visible labels on the controls, "Ordenar" beside its select on the
  // right, its box as wide as the search's and on the same quiet line (an order narrows nothing).
  // The search applies when it is sent (Enter), the order as soon as it is picked; an order that is
  // not one of `sorts` falls back to `fallback`. The caller turns the change into the list's address. `children` holds the list's own
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

<div class="{className} flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
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
      class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
    />
    <TextInput
      id="{id}-search"
      name="q"
      type="search"
      maxlength={100}
      aria-label={searchLabel}
      placeholder={searchPlaceholder}
      bind:value={text}
      class="input h-11 w-full rounded-lg border-control border-surface-200-800 pr-3 pl-10 text-sm"
    />
  </form>
  {@render children?.()}
  <SearchSelect
    id="{id}-sort"
    name="sort"
    label={sortLabel}
    labelClass="text-sm font-semibold text-muted"
    class="flex w-full items-center gap-2 sm:w-72 md:ml-auto md:w-auto"
    controlClass="md:w-85"
    compact
    active={false}
    items={[...sorts]}
    value={[sort]}
    placeholder={sortLabel}
    onchange={(next) => onapply({ sort: known(next[0]) ? next[0] : fallback })}
  />
</div>
