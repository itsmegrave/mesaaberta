<script lang="ts">
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import PartnerForm from '../../../components/PartnerForm.svelte';
  import PartnerOwners from '../../../components/PartnerOwners.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form = null } = $props();
  // svelte-ignore state_referenced_locally
  // The edit form's own answer; the "Quem cuida" actions answer with their own forms.
  const initial = (
    form && 'form' in form && form.form && 'linkUrl' in form.form.data ? form.form : data.form
  ) as typeof data.form;
</script>

<svelte:head><title>{m.partner_edit_title()}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-8">
  <Breadcrumbs
    class="mb-8"
    items={[{ label: m.partner_nav_label(), href: '/partners' }, { label: m.partner_edit_title() }]}
  />
  <h1 class="text-3xl leading-none font-semibold tracking-tight text-balance md:text-5xl">
    {m.partner_edit_title()}
  </h1>
  <PartnerForm {initial} mode="edit" logoUrl={data.logoUrl} />
  {#if data.owners}
    <!-- Its own forms, so after the edit form rather than inside it. As wide as the form's fields:
         two of its three columns and the gap between them (gap-8 = 3rem). -->
    <div class="mt-8 lg:w-[calc((200%-3rem)/3)]">
      <PartnerOwners
        partner={initial.data.name}
        owners={data.owners.owners}
        invitations={data.owners.invitations}
        you={data.owners.you}
      />
    </div>
  {/if}
</section>
