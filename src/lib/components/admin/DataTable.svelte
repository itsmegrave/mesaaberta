<script lang="ts" module>
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
</script>

<script lang="ts" generics="T extends RowData">
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
  import Icon from '$lib/components/Icon.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import FilterSheet from '$lib/components/admin/FilterSheet.svelte';
  import ListSearch from '$lib/components/admin/ListSearch.svelte';
  import Pager from '$lib/components/admin/Pager.svelte';
  import {
    nextSort,
    PAGE_SIZES,
    listPath,
    listQuery,
    pageRange,
    showMore,
    type Sort,
  } from '$lib/admin/list';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

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
    sheet,
    sheetResults,
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
    /** One row of the phone list: a `ListCard`. */
    card: Snippet<[T]>;
    total: number;
    /** "9 mesas": the count the toolbar and the footer say. */
    totalLabel: string;
    page: number;
    pageSize: number;
    sort?: Sort | null;
    /** The column the phone list says it is ordered by ("Próxima sessão"). */
    sortLabel?: string;
    search?: { value: string; label: string; placeholder?: string; maxlength?: number };
    /** Selects beside the search, on the desktop's first row. */
    selects?: Snippet;
    /** The segmented filter, on the desktop's second row and straight under the search on a phone. */
    segments?: Snippet;
    /** What the phone's "Filtros" sheet holds, besides the segments. */
    sheet?: Snippet;
    sheetResults?: string;
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

  const locale = getLocale();
  const features = tableFeatures({});
  const defs = $derived(
    columns.map((column): ColumnDef<typeof features, T> => ({
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
  const meta = (id: string) => columns.find((column) => column.id === id);

  const pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
  const range = $derived(pageRange(page, pageSize, total));
  const href = (changes: Record<string, string | number | null>, withHash = hash) =>
    localizedHref(
      listPath(current.url.pathname, listQuery(current.url.searchParams, changes), withHash),
      locale,
    );
  const go = (changes: Record<string, string | number | null>) =>
    goto(href(changes), { keepFocus: true, noScroll: true });
  const clearHref = $derived(href(Object.fromEntries(filterKeys.map((key) => [key, null]))));
  const more = $derived(showMore(pageSize, rows.length, total));
  // A phone has no pages to turn: "Mostrar mais" asks for the next size, then for the next page.
  const moreHref = $derived(
    more ? href({ size: more.size }, '') : page < pages ? href({ page: page + 1 }, '') : null,
  );
  const sortedBy = (id: string): 'ascending' | 'descending' | undefined =>
    sort?.id === id ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined;
</script>

<section aria-label={caption} aria-busy={busy} class="mt-6">
  <!-- Desktop: one card with the toolbar, the table and the footer. -->
  <div class="hidden rounded-lg border border-surface-200-800 bg-panel md:block">
    {#if search || selects || segments}
      <div class="grid gap-3 border-b border-surface-200-800 p-4">
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
          {@render selects?.()}
          <p role="status" class="ml-auto text-sm font-semibold text-muted">{totalLabel}</p>
        </div>
        {#if segments}<div>{@render segments()}</div>{/if}
      </div>
    {/if}

    <div class="relative overflow-x-auto">
      <table class="w-full text-left text-sm">
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
                  {@render cell(row.original, item.column.id)}
                </td>
              {/each}
            </tr>
          {:else}
            <tr>
              <td colspan={columns.length} class="px-4 py-10 text-center text-muted">
                <p>{empty}</p>
                {#if filtered}
                  <a
                    class="mt-2 inline-flex min-h-11 items-center anchor font-semibold"
                    href={clearHref}>{m.admin_list_clear()}</a
                  >
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div
      class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-200-800 px-4 py-3"
    >
      <p class="text-sm text-muted" aria-live="polite">
        {#if total > 0}{m.admin_list_range({
            from: range.from,
            to: range.to,
            total: totalLabel,
          })}{:else}{totalLabel}{/if}
      </p>
      <div class="flex flex-wrap items-center gap-4">
        {#if sizes}
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
        {/if}
        <Pager {page} {pages} href={(next) => href({ page: next })} />
      </div>
    </div>
  </div>

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
            {@render sheet()}
          </FilterSheet>
        {/if}
      </div>
    {/if}
    {#if segments && !sheet}{@render segments()}{/if}
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
        {#each rows as row (rowId(row))}{@render card(row)}{/each}
      </ul>
    {:else}
      <div class="rounded-lg border border-surface-200-800 bg-panel p-6 text-center text-muted">
        <p>{empty}</p>
        {#if filtered}
          <a class="mt-2 inline-flex min-h-11 items-center anchor font-semibold" href={clearHref}
            >{m.admin_list_clear()}</a
          >
        {/if}
      </div>
    {/if}
    {#if moreHref}
      <a
        class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
        href={moreHref}
        data-sveltekit-noscroll
        >{more ? m.admin_list_more({ count: more.more }) : m.admin_list_next_page()}</a
      >
    {/if}
  </div>
</section>
