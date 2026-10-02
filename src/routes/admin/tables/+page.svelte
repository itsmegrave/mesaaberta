<script lang="ts">
  import Spinner from '$lib/components/Spinner.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { navigating } from '$app/state';
  import AdminTablesTable from '$lib/components/AdminTablesTable.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import { m } from '$lib/paraglide/messages';
  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  $effect(() => {
    if (
      !remote.data?.tables.rows.some((row) =>
        ['queued', 'processing', 'publishing'].includes(row.instagramStatus ?? ''),
      )
    )
      return;
    const timer = setInterval(() => {
      void remote.refetch();
    }, 5000);
    return () => clearInterval(timer);
  });
  const data = $derived({ ...serverData, ...remote.data });
</script>

<svelte:head><title>{m.admin_tables()} | Mesa Aberta</title></svelte:head>
<section class="py-6 md:py-10">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <h1 class="text-3xl font-semibold">{m.admin_tables()}</h1>
    <Button
      size="custom"
      type="button"
      class="btn h-11 gap-2 rounded-lg preset-tonal-primary px-4"
      disabled={remote.isFetching}
      onclick={() => remote.refetch()}
      >{#if remote.isFetching}<Spinner />{:else}<Icon
          name="refresh-cw"
          size={18}
        />{/if}{m.admin_refresh()}</Button
    >
  </div>
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />
  <AdminTablesTable
    data={data.tables}
    instagramAvailable={data.instagramAvailable}
    busy={remote.isFetching || !!navigating.to}
  />
</section>
