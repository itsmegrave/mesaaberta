<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import ToolForm from '#lib/components/tools/ToolForm.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
</script>

<AdminPage
  title={m.admin_tools_edit_title({ name: data.name })}
  lede={m.admin_tools_edit_lede()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_nav_tools(), href: '/admin/tools' },
    { label: data.name },
  ]}
>
  <ToolForm {initial} mode="edit" logoUrl={data.logoUrl} cancelHref="/admin/tools" />
</AdminPage>
