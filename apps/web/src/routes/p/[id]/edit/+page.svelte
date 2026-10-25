<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PartnerForm from '../../components/PartnerForm.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
</script>

<svelte:head><title>{m.partner_edit_title()}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.partner_nav_label(), href: '/p' }, { label: m.partner_edit_title() }]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.partner_edit_title()}
  </h1>
  <PartnerForm {initial} mode="edit" logoUrl={data.logoUrl} />
</section>
