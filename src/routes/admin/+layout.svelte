<script lang="ts">
  import { page } from '$app/state';
  import AdminNav from '$lib/components/AdminNav.svelte';

  let { children, data } = $props();
</script>

<div class="grid gap-6 pt-2 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10 md:pt-12">
  <AdminNav route={page.route.id} counts={data.adminCounts} />
  <div class="min-w-0">{@render children()}</div>
</div>
