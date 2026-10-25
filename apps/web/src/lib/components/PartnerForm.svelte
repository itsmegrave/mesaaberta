<script lang="ts">
  import { copyText } from '#lib/clipboard.js';
  // "Quero ser parceiro" and "Editar parceiro": the same form. Name and a line about the partner,
  // the logo, the links (the site and up to six networks), where the link to Mesa Aberta is, and an
  // optional coupon. A preview card sits beside it (below it on a phone). An admin approves what is
  // sent, and an edit takes an approved partner off the page until it is approved again.
  import Button from '#lib/components/Button.svelte';
  import EditorForm from '#lib/components/EditorForm.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ImageUpload from '#lib/components/ImageUpload.svelte';
  import NetworkLinksField from '#lib/components/NetworkLinksField.svelte';
  import PartnerCard from '#lib/components/PartnerCard.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import TextInput from '#lib/components/TextInput.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import type { FormResult } from '#lib/forms/contract.js';
  import { fieldErrors, problem } from '#lib/forms/field-errors.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  import { page as appPage } from '$app/state';

  // The address a partner puts on their site, bio or Discord: the "troca de links" (link exchange).
  const ourLink = $derived(appPage.data.site?.APP_ORIGIN ?? '');
  import {
    editPartnerSchema,
    MAX_PARTNER_LINKS,
    newPartnerSchema,
    PARTNER_LIMITS,
    PARTNER_NETWORKS,
    partnerLinkUrl,
  } from '@mesaaberta/core/partners/schema';
  import type { Network } from '@mesaaberta/core/profile/social-links';
  import { networkLabels } from '#lib/profile/social-presentation.js';
  import { errorText, formProblem } from '#lib/tables/form-values.js';
  import { toast } from '#lib/toaster.js';

  type Values = {
    name: string;
    description: string;
    contactEmail: string;
    siteUrl: string;
    backlinkUrl: string;
    couponCode: string;
    couponDescription: string;
    linkNetwork: string[];
    linkUrl: string[];
    logo?: File;
  };

  let {
    initial,
    mode,
    logoUrl = null,
  }: {
    initial: FormResult<Values>;
    mode: 'new' | 'edit';
    /** The logo the partner has now (when editing). */
    logoUrl?: string | null;
  } = $props();

  const editing = $derived(mode === 'edit');

  // svelte-ignore state_referenced_locally
  const controller = actionForm<Values>({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
    schema: mode === 'edit' ? editPartnerSchema : newPartnerSchema,
    onSuccess: () => toast.success(m.partner_form_sent()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);
  const { draft } = controller;

  // --- errors --------------------------------------------------------------------------------------

  const codes: Record<string, () => string> = {
    required: m.form_error_required,
    too_small: m.form_error_required,
    too_long: m.form_error_too_big,
    invalid_url: m.partner_err_invalid_url,
    invalid_email: m.partner_err_invalid_email,
    invalid_format: m.partner_err_invalid_url,
    invalid_link: m.partner_err_invalid_link,
    invalid_network: m.partner_err_invalid_link,
    duplicate: m.partner_err_duplicate,
    too_many: () => m.partner_err_too_many({ max: MAX_PARTNER_LINKS }),
    need_a_link: m.partner_err_need_link,
    needs_code: m.partner_err_needs_code,
  };
  const say = (code: string | undefined, field = '') =>
    code ? (codes[code]?.() ?? errorText(code, field)) : undefined;
  const errors = fieldErrors<keyof Values>(controller, say);
  const { err } = errors;
  const logoError = $derived(
    controller.errors.logo?.[0]
      ? controller.errors.logo[0] === 'empty' || controller.errors.logo[0] === 'required'
        ? m.partner_err_logo_required()
        : errorText(controller.errors.logo[0], 'image')
      : errors.withMessage('logo', (code) => errorText(code, 'image')),
  );
  const rowErrors = (index: number) => ({
    url: say(controller.errors[`linkUrl.${index}`]?.[0]),
    network: say(controller.errors[`linkNetwork.${index}`]?.[0]),
  });
  const formError = $derived(formProblem(controller.message));

  const problems = $derived(
    errors.summary(
      [
        ['name', m.partner_form_name()],
        ['description', m.partner_form_description()],
        ['contactEmail', m.partner_form_contact_email()],
        ['siteUrl', m.partner_form_site()],
        ['backlinkUrl', m.partner_form_backlink()],
        ['couponCode', m.partner_form_coupon_code()],
        ['couponDescription', m.partner_form_coupon_description()],
      ],
      problem('logo', m.partner_form_logo(), logoError),
    ),
  );

  // --- the networks: up to six links, each a network and an address ------------------------------

  const networks = PARTNER_NETWORKS.map((network) => ({
    name: networkLabels[network](),
    slug: network,
  }));

  // --- the preview ---------------------------------------------------------------------------------

  // The picked file is shown as it will look; until one is picked, the logo the partner has now.
  let picked = $state<string | null>(null);
  function pick(files: File[]) {
    if (picked) URL.revokeObjectURL(picked);
    picked = files[0] ? URL.createObjectURL(files[0]) : null;
    controller.change('logo', files[0]);
    controller.validateField('logo');
  }

  const card = $derived({
    id: 'preview',
    name: $draft.name || m.partner_form_name(),
    description: $draft.description || null,
    logoUrl: picked ?? logoUrl,
    siteUrl: $draft.siteUrl.trim() ? $draft.siteUrl.trim() : null,
    couponCode: $draft.couponCode.trim() || null,
    couponDescription: $draft.couponCode.trim() ? $draft.couponDescription || null : null,
    links: $draft.linkUrl.flatMap((raw, index) => {
      const network = $draft.linkNetwork[index] as Network;
      const url = raw.trim() ? partnerLinkUrl(network, raw) : null;
      return url && network !== 'website'
        ? [{ network: network as Exclude<Network, 'website'>, url }]
        : [];
    }),
  });

  function copyOurLink() {
    return copyText(ourLink, m.toast_link_copied());
  }

  const input = 'input h-12 rounded-lg border-surface-200-800 bg-panel px-3';
  const secondary =
    'btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and show validation in the same translated messages as the server. -->
<EditorForm
  {controller}
  {problems}
  banner={formError}
  cancelHref="/p"
  note={m.partner_form_review_note()}
>
  {#if editing}
    <p role="note" class="rounded-lg border border-warning-500 bg-panel p-4">
      {m.partner_form_edit_notice()}
    </p>
  {/if}

  <FormSection id="about-section" title={m.partner_form_about()}>
    <FormField
      id="name"
      label={m.partner_form_name()}
      error={err('name')}
      counter={{ count: $draft.name.length, max: PARTNER_LIMITS.name }}
    >
      {#snippet children(aria)}
        <TextInput
          id="name"
          name="name"
          maxlength={PARTNER_LIMITS.name}
          bind:value={$draft.name}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    <FormField
      id="description"
      label={m.partner_form_description()}
      optional
      hint={m.partner_form_description_hint()}
      error={err('description')}
      counter={{ count: $draft.description.length, max: PARTNER_LIMITS.description }}
    >
      {#snippet children(aria)}
        <TextInput
          id="description"
          name="description"
          maxlength={PARTNER_LIMITS.description}
          bind:value={$draft.description}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    <FormField
      id="contactEmail"
      label={m.partner_form_contact_email()}
      optional
      tip={m.partner_form_contact_email_tip()}
      error={err('contactEmail')}
    >
      {#snippet children(aria)}
        <TextInput
          id="contactEmail"
          name="contactEmail"
          type="email"
          inputmode="email"
          autocomplete="email"
          autocapitalize="none"
          spellcheck="false"
          maxlength={PARTNER_LIMITS.contactEmail}
          bind:value={$draft.contactEmail}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  <FormSection id="logo-section" title={m.partner_form_logo()}>
    <ImageUpload
      id="logo"
      name="logo"
      kind="avatar"
      label={editing ? `${m.partner_form_logo()} (${m.form_optional()})` : m.partner_form_logo()}
      hint={editing ? m.partner_form_logo_hint_edit() : m.partner_form_logo_hint()}
      error={logoError}
      currentUrl={logoUrl}
      onpick={pick}
    />
  </FormSection>

  <FormSection id="links-section" title={m.partner_form_links()} hint={m.partner_form_links_hint()}>
    <FormField id="siteUrl" label={m.partner_form_site()} optional error={err('siteUrl')}>
      {#snippet children(aria)}
        <TextInput
          id="siteUrl"
          name="siteUrl"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="https://"
          bind:value={$draft.siteUrl}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>

    <NetworkLinksField
      bind:networks={$draft.linkNetwork}
      bind:urls={$draft.linkUrl}
      items={networks}
      max={MAX_PARTNER_LINKS}
      idPrefix="partner-link"
      legend={m.partner_form_networks()}
      error={say(controller.errors.linkUrl?.[0])}
      {rowErrors}
      placeholder={(network) =>
        network === 'discord' ? 'https://discord.gg/…' : m.partner_link_placeholder()}
      labels={{
        network: (n) => m.partner_link_network({ n }),
        url: (n) => m.partner_link_url({ n }),
        remove: (n) => m.partner_link_remove({ n }),
        add: m.partner_link_add(),
        removed: m.partner_link_removed,
      }}
      inputClass={input}
      buttonClass={secondary}
    />
  </FormSection>

  <FormSection
    id="exchange-section"
    title={m.partner_form_exchange()}
    hint={m.partner_form_exchange_hint()}
  >
    <div class="grid gap-1">
      <p class="label-text font-semibold">{m.partner_our_link()}</p>
      <div class="flex items-center justify-between gap-2">
        <code class="min-w-0 truncate font-mono text-sm">{ourLink}</code>
        <Button size="custom" type="button" class={secondary} onclick={() => void copyOurLink()}>
          <Icon name="copy" size={18} />{m.partner_copy()}
        </Button>
      </div>
    </div>
    <FormField
      id="backlinkUrl"
      label={m.partner_form_backlink()}
      optional
      hint={m.partner_form_backlink_hint()}
      error={err('backlinkUrl')}
    >
      {#snippet children(aria)}
        <TextInput
          id="backlinkUrl"
          name="backlinkUrl"
          type="text"
          inputmode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          placeholder="https://"
          bind:value={$draft.backlinkUrl}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  <FormSection
    id="coupon-section"
    icon="ticket-percent"
    title={m.partner_form_coupon()}
    hint={m.partner_form_coupon_hint()}
  >
    <FormField
      id="couponCode"
      label={m.partner_form_coupon_code()}
      optional
      error={err('couponCode')}
      counter={{ count: $draft.couponCode.length, max: PARTNER_LIMITS.couponCode }}
    >
      {#snippet children(aria)}
        <TextInput
          id="couponCode"
          name="couponCode"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          maxlength={PARTNER_LIMITS.couponCode}
          bind:value={$draft.couponCode}
          class="{input} font-mono"
          {...aria}
        />
      {/snippet}
    </FormField>
    <FormField
      id="couponDescription"
      label={m.partner_form_coupon_description()}
      optional
      hint={m.partner_form_coupon_description_hint()}
      error={err('couponDescription')}
      counter={{
        count: $draft.couponDescription.length,
        max: PARTNER_LIMITS.couponDescription,
      }}
    >
      {#snippet children(aria)}
        <TextInput
          id="couponDescription"
          name="couponDescription"
          maxlength={PARTNER_LIMITS.couponDescription}
          disabled={$draft.couponCode.trim() === ''}
          bind:value={$draft.couponDescription}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  {#snippet actions()}
    <Button
      type="submit"
      size="custom"
      {controller}
      class="btn h-12 gap-2 rounded-lg preset-filled-primary-500 px-7 font-semibold"
      >{editing ? m.partner_form_submit_edit() : m.partner_form_submit()}</Button
    >
  {/snippet}
  {#snippet preview()}
    <PartnerCard partner={card} />
  {/snippet}
</EditorForm>
