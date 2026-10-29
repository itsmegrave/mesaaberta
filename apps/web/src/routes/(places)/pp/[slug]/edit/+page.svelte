<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PlaceForm from '../../../components/PlaceForm.svelte';
  import PlaceHosts from '../../../components/PlaceHosts.svelte';
  import PlacePartner from '../../../components/PlacePartner.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  // The edit form's own answer; the "Parceiro" actions answer with their own forms.
  const initial = (
    form && 'form' in form && form.form && 'street' in form.form.data ? form.form : data.form
  ) as typeof data.form;
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
    action="?/save"
    mode="edit"
    imageUrl={data.imageUrl}
    reviewAgain={data.reviewAgain}
    approved={data.approved}
    cancelHref="/pp/{data.slug}"
    tagOptions={data.tagOptions}
    catalog={data.catalog}
  />
  {#if data.partner || data.hosts}
    <!-- Their own forms, so after the edit form; as wide as the form's fields (see Editar parceiro). -->
    <div class="mt-8 grid gap-8 lg:w-[calc((200%-3rem)/3)]">
      {#if data.partner}<PlacePartner {...data.partner} />{/if}
      {#if data.hosts}<PlaceHosts
          hosts={data.hosts.hosts}
          invitations={data.hosts.invitations}
        />{/if}
    </div>
  {/if}
</section>
