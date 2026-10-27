<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PlaceForm from '../../components/PlaceForm.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
</script>

<svelte:head><title>{m.place_new_title()}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.places_crumb(), href: '/places' }, { label: m.place_new_title() }]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.place_new_title()}
  </h1>
  <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
    {m.place_new_lede()}
  </p>
  <PlaceForm {initial} mode="new" />
</section>
