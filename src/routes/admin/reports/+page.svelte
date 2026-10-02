<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import AdminReportsTable from '$lib/components/admin/AdminReportsTable.svelte';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
</script>

<svelte:head><title>{m.admin_reports_title()} | Mesa Aberta</title></svelte:head>

<section class="py-6 md:py-10">
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_reports_title() }]}
    class="mb-6"
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.admin_reports_title()}
  </h1>
  <p class="mt-4 max-w-2xl text-lg">{m.admin_reports_lede()}</p>
  <AdminReportsTable data={data.reports} />
</section>
