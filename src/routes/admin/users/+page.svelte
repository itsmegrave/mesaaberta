<script lang="ts">
  import { navigating } from '$app/state';
  import AdminProfilesTable from '$lib/components/AdminProfilesTable.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import { m } from '$lib/paraglide/messages';
  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
</script>

<svelte:head><title>{m.admin_profile_list()} | Mesa Aberta</title></svelte:head>
<section class="py-6 md:py-10">
  <h1 class="text-3xl font-semibold">{m.admin_profile_list()}</h1>
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />
  <AdminProfilesTable data={data.profiles} busy={remote.isFetching || !!navigating.to} />
</section>
