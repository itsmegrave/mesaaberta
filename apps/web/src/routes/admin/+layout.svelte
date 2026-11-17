<script lang="ts">
  import { navigating, page } from '$app/state';
  import ListSkeleton from '#lib/components/ui/ListSkeleton.svelte';
  import { adminSkeleton } from '#lib/navigation/skeletons.js';
  import { Slow } from '#lib/navigation/slow.svelte.js';
  import AdminNav from './components/ui/AdminNav.svelte';
  import { provideAdminCounts } from '#lib/admin/counts.svelte.js';

  let { children, data } = $props();
  const counts = provideAdminCounts(() => data.adminCounts);
  // Another section on its way: its skeleton beside the nav, after the same 150 ms as the top bar.
  const loading = new Slow(() => navigating.to, 150);
  const arriving = $derived(adminSkeleton(page.url, loading.current));
</script>

<!-- The sections' column is 236px and the content sits 28px (gap-7) to its right. -->
<div class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
  <AdminNav
    route={page.route.id}
    path={page.url.pathname}
    counts={counts.current}
    connectionsPath={data.adminConnections}
    sections={data.adminSections}
    badges={data.adminBadges}
  />
  <div class="min-w-0">
    {#if arriving}<ListSkeleton kind="admin" />{:else}{@render children()}{/if}
  </div>
</div>
