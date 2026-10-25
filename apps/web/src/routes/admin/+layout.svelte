<script lang="ts">
  import { page } from '$app/state';
  import AdminNav from './components/ui/AdminNav.svelte';
  import { provideAdminCounts } from '#lib/admin/counts.svelte.js';

  let { children, data } = $props();
  const counts = provideAdminCounts(() => data.adminCounts);
</script>

<!-- The sections' column is 236px and the content sits 28px (gap-7) to its right. -->
<div class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
  <AdminNav route={page.route.id} counts={counts.current} connectionsPath={data.adminConnections} />
  <div class="min-w-0">{@render children()}</div>
</div>
