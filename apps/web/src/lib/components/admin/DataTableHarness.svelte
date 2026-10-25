<script lang="ts">
  // A DataTable with a column, a segmented filter and, when asked, a select, the row menu and the
  // phone's filter sheet, for its spec.
  import DataTable from './DataTable.svelte';
  import FilterSelect from './FilterSelect.svelte';
  import ListCard from './ListCard.svelte';
  import SegmentedFilter from './SegmentedFilter.svelte';
  import type { Snippet } from 'svelte';

  type Row = { id: string; name: string };
  let {
    rows,
    total = rows.length,
    page = 1,
    pageSize = 20,
    sort = null,
    filtered = false,
    withMenu = false,
    busyRow = null,
    withSelect = false,
    sheet = false,
  }: {
    rows: Row[];
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: { id: string; dir: 'asc' | 'desc' } | null;
    filtered?: boolean;
    withMenu?: boolean;
    /** The row whose action is running: its menu is a spinner. */
    busyRow?: string | null;
    withSelect?: boolean;
    sheet?: boolean;
  } = $props();
</script>

{#snippet select({ inSheet }: { inSheet: boolean })}
  <FilterSelect
    id={inSheet ? 'kind-filter-sheet' : 'kind-filter'}
    name="kind"
    label="Tipo"
    options={[
      { slug: 'all', name: 'Todos' },
      { slug: 'big', name: 'Grandes' },
    ]}
    value="all"
    class={inSheet ? 'w-full' : 'w-56'}
    inDialog={inSheet}
  />
{/snippet}

<DataTable
  {rows}
  columns={withMenu
    ? [{ id: 'name', header: 'Nome', sortable: true }]
    : [
        { id: 'name', header: 'Nome', sortable: true },
        { id: 'actions', header: 'Ações', hideHeader: true },
      ]}
  rowId={(row: Row) => row.id}
  caption="Itens"
  {total}
  totalLabel="{total} itens"
  {page}
  {pageSize}
  {sort}
  search={{ value: '', label: 'Buscar item' }}
  {filtered}
  empty="Nenhum item."
  {sheet}
  menu={withMenu
    ? (row: Row) => ({
        name: `Ações de ${row.name}`,
        items: [{ id: 'open', label: 'Abrir', icon: 'eye', href: `/things/${row.id}` }],
        busy: busyRow === row.id,
      })
    : undefined}
  selects={withSelect ? select : undefined}
>
  {#snippet segments()}
    <SegmentedFilter
      name="status"
      label="Status"
      options={[
        { value: 'all', label: 'Todos', count: total },
        { value: 'on', label: 'Ligados', count: 1 },
      ]}
      value="all"
    />
  {/snippet}
  {#snippet cell(row: Row, id: string)}
    {#if id === 'name'}<p class="truncate">{row.name}</p>{/if}
  {/snippet}
  {#snippet card(row: Row, action: Snippet | undefined)}
    <ListCard {action}>
      {#snippet title()}{row.name}{/snippet}
    </ListCard>
  {/snippet}
</DataTable>
