<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { Panel } = $derived(data);
</script>

<AdminPage
  title={m.admin_connections_title()}
  tabTitle={`${m.admin_connections_title()} · Mesa Aberta`}
  lede={m.admin_connections_description()}
>
  <Panel {data} />
</AdminPage>
