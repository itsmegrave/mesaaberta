<script lang="ts">
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
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
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_profile_list() }]}
    class="mb-6"
  />
  <AdminPageHead title={m.admin_profile_list()} lede={m.admin_users_lede()} />
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />
  <AdminProfilesTable data={data.profiles} busy={remote.isFetching || !!navigating.to} />
</section>
