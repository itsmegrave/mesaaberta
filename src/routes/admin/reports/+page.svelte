<script lang="ts">
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
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
  <AdminPageHead title={m.admin_reports_title()} lede={m.admin_reports_lede()} />
  <AdminReportsTable data={data.reports} />
</section>
