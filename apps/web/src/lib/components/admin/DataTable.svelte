<script lang="ts" module>
  import type { KebabItem } from '#lib/components/ui/KebabMenu.svelte';

  export type DataColumn = {
    id: string;
    /** The header's words; an icon-only column (the row's menu) gives its name and hides it. */
    header: string;
    /** Orders the list by this column: only what an admin really orders by (a date, a name, a count). */
    sortable?: boolean;
    /** Tailwind width of the column; the one without takes what is left. */
    width?: string;
    align?: 'right';
    hideHeader?: boolean;
  };
  /** A row's KebabMenu; `busy` swaps it for a Spinner while the row's action runs. */
  export type RowMenu = { name: string; items: KebabItem[]; busy?: boolean };
  /** Where a filter snippet is drawn: the desktop toolbar, or the phone's "Filtros" sheet. */
  export type FilterPlace = { inSheet: boolean };
</script>

<script lang="ts" generics="T extends RowData">
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  // Every list an admin works through is this one pattern on TanStack Table: one bordered card with
  // the toolbar, a header row on the wash, the rows and a footer; on a phone no table, but a list of
  // cards with a "Filtros" sheet and "Mostrar mais". The address is the state (`?q=&status=&sort=&dir=
  // &page=&size=`), so a filtered list is a link, and the server pages, sorts and counts.
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { page as current } from '$app/state';
  import {
    createTable,
    FlexRender,
    tableFeatures,
    type ColumnDef,
    type RowData,
  } from '@tanstack/svelte-table';
  import Icon from '#lib/components/ui/Icon.svelte';
  import KebabMenu from '#lib/components/ui/KebabMenu.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import FilterSheet from '#lib/components/admin/ui/FilterSheet.svelte';
  import ListSearch from '#lib/components/admin/ListSearch.svelte';
  import ListPanel from '#lib/components/admin/ListPanel.svelte';
  import Spinner from '#lib/components/ui/Spinner.svelte';
  import {
    nextSort,
    PAGE_SIZES,
    listPath,
    listQuery,
    showMore,
    type Sort,
  } from '@mesaaberta/core/admin/list';
  import { m } from '#lib/paraglide/messages.js';

  let {
    rows,
    columns,
    rowId,
    caption,
    cell,
    card,
    total,
    totalLabel,
    page,
    pageSize,
    sort = null,
    sortLabel,
    search,
    selects,
    segments,
    sheet = false,
    sheetResults,
    menu,
    filterKeys = ['q', 'status', 'page'],
    filtered = false,
    empty,
    busy = false,
    sizes = true,
    hash = '',
  }: {
    rows: T[];
    columns: DataColumn[];
    rowId: (row: T) => string;
    /** The table's name for assistive technology. */
    caption: string;
    /** One cell of the desktop table, by column id. */
    cell: Snippet<[T, string]>;
    /** One row of the phone list: a `ListCard`, given the row's menu for its `action`. */
    card: Snippet<[T, Snippet | undefined]>;
    total: number;
    /** "9 mesas": the count the toolbar and the footer say. */
    totalLabel: string;
    page: number;
    pageSize: number;
    sort?: Sort | null;
    /** The column the phone list says it is ordered by ("Próxima sessão"). */
    sortLabel?: string;
    search?: { value: string; label: string; placeholder?: string; maxlength?: number };
    /** Selects beside the search, on the desktop's first row; on a phone only in the sheet. */
    selects?: Snippet<[FilterPlace]>;
    /** The segmented filter, on the desktop's second row and straight under the search on a phone. */
    segments?: Snippet<[FilterPlace]>;
    /** On a phone the segments and the selects go into a "Filtros" sheet beside the search. */
    sheet?: boolean;
    sheetResults?: string;
    /** The row's menu: it adds the last, unnamed column and fills the phone card's action. */
    menu?: (row: T) => RowMenu | null;
    /** The query parameters "Limpar filtros" removes. */
    filterKeys?: string[];
    /** Whether any filter is on: it shows "Limpar filtros" in the empty state. */
    filtered?: boolean;
    /** "Nenhuma mesa encontrada." */
    empty: string;
    busy?: boolean;
    /** The "Por página" choice; off for a list that has one size. */
    sizes?: boolean;
    hash?: string;
  } = $props();

  const features = tableFeatures({});
  const allColumns = $derived<DataColumn[]>(
    menu
      ? [
          ...columns,
          { id: 'actions', header: m.admin_profile_actions(), hideHeader: true, width: 'w-16' },
        ]
      : columns,
  );
  const defs = $derived(
    allColumns.map((column): ColumnDef<typeof features, T> => ({
      id: column.id,
      header: () => column.header,
    })),
  );
  const table = createTable({
    features,
    get columns() {
      return defs;
    },
    get data() {
      return rows;
    },
    getRowId: (row) => rowId(row),
  });
  const meta = (id: string) => allColumns.find((column) => column.id === id);

  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const href = (changes: Record<string, string | number | null>, withHash = hash) =>
    listPath(current.url.pathname, listQuery(current.url.searchParams, changes), withHash);
  const go = (changes: Record<string, string | number | null>) =>
    goto(href(changes), { reset: false });
  const clearHref = $derived(href(Object.fromEntries(filterKeys.map((key) => [key, null]))));
  const more = $derived(showMore(pageSize, rows.length, total));
  // A phone has no pages to turn: "Mostrar mais" asks for the next size, then for the next page.
  const moreHref = $derived(
    more ? href({ size: more.size }, '') : page < pages ? href({ page: page + 1 }, '') : null,
  );
  const sortedBy = (id: string): 'ascending' | 'descending' | undefined =>
    sort?.id === id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
</script>

{#snippet rowMenu(row: T)}
  {@const choice = menu?.(row)}
  {#if choice?.busy}<Spinner />{:else if choice}<KebabMenu
      name={choice.name}
      items={choice.items}
    />{/if}
{/snippet}

{#snippet toolbar()}
  <div class="flex flex-wrap items-center gap-3">
    {#if search}
      <ListSearch
        value={search.value}
        label={search.label}
        placeholder={search.placeholder}
        maxlength={search.maxlength}
        {hash}
      />
    {/if}
    {@render selects?.({ inSheet: false })}
    <p role="status" class="ml-auto text-sm font-semibold text-muted">{totalLabel}</p>
  </div>
  {#if segments}<div>{@render segments({ inSheet: false })}</div>{/if}
{/snippet}

{#snippet sizeChoice()}
  <div class="w-44">
    <SearchSelect
      id="page-size"
      name="size"
      label={m.admin_profile_size()}
      labelClass="text-sm"
      class="flex items-center gap-2"
      compact
      items={PAGE_SIZES.map((size) => ({ name: String(size), slug: String(size) }))}
      value={[String(pageSize)]}
      placeholder={String(pageSize)}
      disabled={busy}
      onchange={(picked) => {
        // The select also reports the size the page already has; only a new size starts over.
        const size = Number(picked[0] ?? pageSize);
        if (size !== pageSize) void go({ size: size === PAGE_SIZES[0] ? null : size });
      }}
    />
  </div>
{/snippet}

<section aria-label={caption} aria-busy={busy} class="mt-6">
  <!-- Desktop: one card with the toolbar, the table and the footer. -->
  <ListPanel
    as="div"
    class="hidden md:block"
    toolbar={search || selects || segments ? toolbar : undefined}
    {total}
    {totalLabel}
    {page}
    {pageSize}
    {pages}
    pageHref={(next) => href({ page: next })}
    footer={sizes ? sizeChoice : undefined}
  >
    <!-- `table-fixed`: every list has one column without a width (the name) and it takes what the
         others leave, so its `truncate` works. In the automatic layout a long description made
         the column as wide as the text, the table wider than the card, and the card scrolled
         sideways with the other columns out of sight. A narrow desktop scrolls on purpose, at
         `min-w-3xl`, rather than squeezing the name to nothing. -->
    <div class="relative overflow-x-auto">
      <table class="w-full min-w-3xl table-fixed text-left text-sm">
        <caption class="sr-only">{caption}</caption>
        <thead class="bg-surface-wash text-muted">
          {#each table.getHeaderGroups() as group (group.id)}
            <tr>
              {#each group.headers as header (header.id)}
                {@const column = meta(header.column.id)}
                <th
                  scope="col"
                  aria-sort={sortedBy(header.column.id)}
                  class="px-4 py-3 font-semibold {column?.width ?? ''} {column?.align === 'right'
                    ? 'text-right'
                    : ''}"
                >
                  {#if column?.hideHeader}
                    <span class="sr-only"><FlexRender {header} /></span>
                  {:else if column?.sortable}
                    <button
                      type="button"
                      class="-mx-2 inline-flex min-h-10 items-center gap-1 rounded-md px-2 font-semibold hover:preset-tonal"
                      onclick={() => {
                        const next = nextSort(sort ?? { id: '', dir: 'asc' }, header.column.id);
                        void go({ sort: next.id, dir: next.dir });
                      }}
                    >
                      <FlexRender {header} />
                      <Icon
                        name="chevron-down"
                        size={16}
                        class={sort?.id === header.column.id
                          ? sort.dir === 'asc'
                            ? 'rotate-180 text-inherit'
                            : 'text-inherit'
                          : 'opacity-40'}
                      />
                    </button>
                  {:else}
                    <FlexRender {header} />
                  {/if}
                </th>
              {/each}
            </tr>
          {/each}
        </thead>
        <tbody class="divide-y divide-surface-200-800">
          {#each table.getRowModel().rows as row (row.id)}
            <tr class="min-h-17 hover:bg-surface-wash has-aria-expanded:bg-surface-wash">
              {#each row.getAllCells() as item (item.id)}
                {@const column = meta(item.column.id)}
                <td
                  class="min-w-0 px-4 py-3 align-middle {column?.align === 'right'
                    ? 'text-right tabular-nums'
                    : ''}"
                >
                  {#if menu && item.column.id === 'actions'}
                    {@render rowMenu(row.original)}
                  {:else}
                    {@render cell(row.original, item.column.id)}
                  {/if}
                </td>
              {/each}
            </tr>
          {:else}
            <tr>
              <td colspan={allColumns.length} class="px-4 py-10 text-center text-muted">
                <p>{empty}</p>
                {#if filtered}
                  <a class="mt-3 {buttonClass('secondary', 'sm')} font-semibold" href={clearHref}
                    >{m.admin_list_clear()}</a
                  >
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </ListPanel>

  <!-- Phone: no table. One list of cards, the filters in a sheet, and "Mostrar mais". -->
  <div class="grid grid-cols-[minmax(0,1fr)] gap-3 md:hidden">
    {#if search || sheet}
      <div class="flex items-center gap-2">
        {#if search}
          <ListSearch
            value={search.value}
            label={search.label}
            placeholder={search.placeholder}
            maxlength={search.maxlength}
            {hash}
          />
        {/if}
        {#if sheet}
          <FilterSheet
            active={filtered ? 1 : 0}
            results={sheetResults ?? totalLabel}
            clearHref={filtered ? clearHref : undefined}
          >
            {#if selects}
              <div class="grid gap-4">
                {@render segments?.({ inSheet: true })}
                {@render selects({ inSheet: true })}
              </div>
            {:else}
              {@render segments?.({ inSheet: true })}
            {/if}
          </FilterSheet>
        {/if}
      </div>
    {/if}
    {#if segments && !sheet}{@render segments({ inSheet: false })}{/if}
    <div class="flex items-center justify-between gap-3 text-sm">
      <p role="status" class="font-semibold">{totalLabel}</p>
      {#if sortLabel && sort}
        <p class="text-muted">
          {sort.dir === 'asc'
            ? m.admin_list_sorted_asc({ column: sortLabel })
            : m.admin_list_sorted_desc({ column: sortLabel })}
        </p>
      {/if}
    </div>
    {#if rows.length > 0}
      <ul
        data-testid="list-rows"
        class="divide-y divide-surface-200-800 rounded-lg border border-surface-200-800 bg-panel"
      >
        {#each rows as row (rowId(row))}
          {#snippet action()}{@render rowMenu(row)}{/snippet}
          {@render card(row, menu?.(row) ? action : undefined)}
        {/each}
      </ul>
    {:else}
      <div class="rounded-lg border border-surface-200-800 bg-panel p-6 text-center text-muted">
        <p>{empty}</p>
        {#if filtered}
          <a class="mt-3 {buttonClass('secondary', 'sm')} font-semibold" href={clearHref}
            >{m.admin_list_clear()}</a
          >
        {/if}
      </div>
    {/if}
    {#if moreHref}
      <a
        class="btn h-12 rounded-lg btn-secondary px-4 font-semibold"
        href={moreHref}
        data-sveltekit-noscroll
        >{more ? m.admin_list_more({ count: more.more }) : m.admin_list_next_page()}</a
      >
    {/if}
  </div>
</section>
