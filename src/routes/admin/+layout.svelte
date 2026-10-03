<script lang="ts">
  import { page } from '$app/state';
  import AdminNav from '$lib/components/AdminNav.svelte';

  let { children, data } = $props();
</script>

<!-- The sections' column is 236px and the content sits 28px (gap-7) to its right. -->
<div class="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-7">
  <AdminNav route={page.route.id} counts={data.adminCounts} />
  <div class="min-w-0">{@render children()}</div>
</div>
