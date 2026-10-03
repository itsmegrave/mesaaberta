<script lang="ts">
  // A DataTable with two columns and a segmented filter, for its spec.
  import DataTable from './DataTable.svelte';
  import ListCard from './ListCard.svelte';
  import SegmentedFilter from './SegmentedFilter.svelte';

  type Row = { id: string; name: string };
  let {
    rows,
    total = rows.length,
    page = 1,
    pageSize = 20,
    sort = null,
    filtered = false,
  }: {
    rows: Row[];
    total?: number;
    page?: number;
    pageSize?: number;
    sort?: { id: string; dir: 'asc' | 'desc' } | null;
    filtered?: boolean;
  } = $props();
</script>

<DataTable
  {rows}
  columns={[
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
    {#if id === 'name'}{row.name}{/if}
  {/snippet}
  {#snippet card(row: Row)}
    <ListCard>
      {#snippet title()}{row.name}{/snippet}
    </ListCard>
  {/snippet}
</DataTable>
