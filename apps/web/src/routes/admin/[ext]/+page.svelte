<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const { Panel } = $derived(data);
  // An extension with a section of its own names it; the others are panels of the connections page.
  const title = $derived(data.section?.label ?? m.admin_connections_title());
</script>

<AdminPage
  {title}
  tabTitle={`${title} · Mesa Aberta`}
  lede={data.section?.lede ?? m.admin_connections_description()}
>
  <Panel {data} />
</AdminPage>
