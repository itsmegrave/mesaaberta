<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import ToolForm from '#lib/components/tools/ToolForm.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
</script>

<svelte:head><title>{m.tool_new_title()}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.nav_tools(), href: '/tools' }, { label: m.tool_new_title() }]}
  />
  <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {m.tool_new_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {m.tool_new_lede()}
  </p>
  <ToolForm {initial} mode="new" cancelHref="/tools" />
</section>
