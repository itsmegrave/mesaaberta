<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PlaceForm from '../../../components/PlaceForm.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = form?.form ?? data.form;
</script>

<svelte:head><title>{m.place_edit_title()}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[
      { label: m.places_crumb(), href: '/places' },
      { label: initial.data.name, href: `/pp/${data.slug}` },
      { label: m.place_edit_title() },
    ]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-7xl">
    {m.place_edit_title()}
  </h1>
  <PlaceForm
    {initial}
    mode="edit"
    imageUrl={data.imageUrl}
    reviewAgain={data.reviewAgain}
    approved={data.approved}
    cancelHref="/pp/{data.slug}"
  />
</section>
