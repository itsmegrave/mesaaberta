<script lang="ts">
  // "Quero ser parceiro" and "Editar parceiro": the same form. Name and a line about the partner,
  // the logo, the links (the site and up to six networks), where the link to Mesa Aberta is, and an
  // optional coupon. A preview card sits beside it (below it on a phone). An admin approves what is
  // sent, and an edit takes an approved partner off the page until it is approved again.
  import { tick } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import ErrorSummary from '$lib/components/ErrorSummary.svelte';
  import Form from '$lib/components/Form.svelte';
  import FormBanner from '$lib/components/FormBanner.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ImageUpload from '$lib/components/ImageUpload.svelte';
  import PartnerCard from '$lib/components/PartnerCard.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import type { FormResult } from '$lib/forms/contract';
  import { guardDraft } from '$lib/forms/guard.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { OUR_LINK } from '$lib/partners/our-link';
  import {
    editPartnerSchema,
    MAX_PARTNER_LINKS,
    newPartnerSchema,
    PARTNER_LIMITS,
    PARTNER_NETWORKS,
    partnerLinkUrl,
  } from '$lib/partners/schema';
  import type { Network } from '$lib/profile/social-links';
  import { networkLabels } from '$lib/profile/social-presentation';
  import { errorText, formProblem } from '$lib/tables/form-values';
  import { toast } from '$lib/toaster';

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

  const locale = getLocale();
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
  const err = (field: string) => say(controller.errors[field]?.[0], field);
  const logoError = $derived(
    controller.errors.logo?.[0]
      ? controller.errors.logo[0] === 'empty' || controller.errors.logo[0] === 'required'
        ? m.partner_err_logo_required()
        : errorText(controller.errors.logo[0], 'image')
      : controller.message?.field === 'logo'
        ? errorText(controller.message.code, 'image')
        : undefined,
  );
  const itemError = (field: 'linkNetwork' | 'linkUrl', index: number) =>
    say(controller.errors[`${field}.${index}`]?.[0]);
  const listError = () => say(controller.errors.linkUrl?.[0]);
  const problem = $derived(formProblem(controller.message));

  const summary = $derived(
    (
      [
        ['name', m.partner_form_name()],
        ['description', m.partner_form_description()],
        ['contactEmail', m.partner_form_contact_email()],
        ['siteUrl', m.partner_form_site()],
        ['backlinkUrl', m.partner_form_backlink()],
        ['couponCode', m.partner_form_coupon_code()],
        ['couponDescription', m.partner_form_coupon_description()],
      ] as const
    ).flatMap(([field, label]) => {
      const message = err(field);
      return message ? [{ id: field, label, message }] : [];
    }),
  );
  const problems = $derived(
    logoError
      ? [...summary, { id: 'logo', label: m.partner_form_logo(), message: logoError }]
      : summary,
  );

  // --- the networks: a list to add to and remove from ----------------------------------------------

  // Each row keeps an id of its own, so a row that is removed does not move what was typed in another.
  let nextId = 0;
  let ids = $state($draft.linkNetwork.map(() => nextId++));
  let announcement = $state('');
  let addButton: HTMLButtonElement | undefined = $state();
  const canAdd = $derived(ids.length < MAX_PARTNER_LINKS);

  function addLink() {
    $draft.linkNetwork = [...$draft.linkNetwork, 'instagram'];
    $draft.linkUrl = [...$draft.linkUrl, ''];
    const id = nextId++;
    ids.push(id);
    tick().then(() => document.getElementById(`partner-link-url-${id}`)?.focus());
  }

  function removeLink(index: number) {
    $draft.linkNetwork = $draft.linkNetwork.filter((_, i) => i !== index);
    $draft.linkUrl = $draft.linkUrl.filter((_, i) => i !== index);
    ids.splice(index, 1);
    announcement = m.partner_link_removed();
    // The row that had the focus is gone: keep the focus in the list.
    tick().then(() => addButton?.focus());
  }

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

  const preview = $derived({
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

  async function copyOurLink() {
    try {
      await navigator.clipboard.writeText(OUR_LINK);
      toast.success(m.toast_link_copied());
    } catch {
      // Clipboard access refused: nothing was copied, and nothing is claimed.
    }
  }

  const input = 'input h-12 rounded-lg border-surface-200-800 bg-panel px-3';
  const secondary =
    'btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8';
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and show validation in the same translated messages as the server. -->
<Form
  enctype="multipart/form-data"
  onsubmit={controller.submit}
  onfocusout={controller.blur}
  class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12"
>
  <div class="grid gap-8 lg:col-span-2">
    <ErrorSummary errors={problems} />
    <FormBanner text={problem} />
    {#if editing}
      <p role="note" class="rounded-lg border border-warning-500 bg-panel p-4">
        {m.partner_form_edit_notice()}
      </p>
    {/if}

    <section aria-labelledby="about-section" class={card}>
      <h2 id="about-section" class="mb-6 text-2xl font-semibold tracking-tight">
        {m.partner_form_about()}
      </h2>
      <div class="grid gap-6">
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
      </div>
    </section>

    <section aria-labelledby="logo-section" class={card}>
      <h2 id="logo-section" class="mb-6 text-2xl font-semibold tracking-tight">
        {m.partner_form_logo()}
      </h2>
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
    </section>

    <section aria-labelledby="links-section" class={card}>
      <h2 id="links-section" class="mb-2 text-2xl font-semibold tracking-tight">
        {m.partner_form_links()}
      </h2>
      <p class="mb-6 text-muted">{m.partner_form_links_hint()}</p>
      <div class="grid gap-6">
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

        <fieldset class="grid gap-3">
          <legend class="font-semibold">{m.partner_form_networks()}</legend>
          {#if listError()}
            <p role="alert" class="text-sm font-semibold text-error-700-300">{listError()}</p>
          {/if}
          <ul class="grid gap-4">
            {#each ids as id, index (id)}
              {@const urlError = itemError('linkUrl', index)}
              {@const networkError = itemError('linkNetwork', index)}
              <li class="grid gap-2 rounded-lg border border-surface-200-800 p-3">
                <div class="grid gap-2 sm:grid-cols-4">
                  <SearchSelect
                    id="partner-link-network-{id}"
                    name="linkNetwork"
                    label={m.partner_link_network({ n: index + 1 })}
                    labelClass="sr-only"
                    class="grid"
                    items={networks}
                    value={[$draft.linkNetwork[index]]}
                    placeholder={m.partner_link_network({ n: index + 1 })}
                    invalid={!!networkError}
                    onchange={(chosen) =>
                      ($draft.linkNetwork[index] = (chosen[0] ?? 'instagram') as Network)}
                  />
                  <TextInput
                    id="partner-link-url-{id}"
                    name="linkUrl"
                    type="text"
                    inputmode="url"
                    autocapitalize="none"
                    spellcheck="false"
                    placeholder={$draft.linkNetwork[index] === 'discord'
                      ? 'https://discord.gg/…'
                      : m.partner_link_placeholder()}
                    aria-label={m.partner_link_url({ n: index + 1 })}
                    bind:value={$draft.linkUrl[index]}
                    class="{input} sm:col-span-3"
                    aria-invalid={urlError ? 'true' : undefined}
                    aria-describedby={urlError ? `partner-link-error-${id}` : undefined}
                  />
                </div>
                {#if urlError || networkError}
                  <p
                    id="partner-link-error-{id}"
                    role="alert"
                    class="text-sm font-semibold text-error-700-300"
                  >
                    {urlError ?? networkError}
                  </p>
                {/if}
                <div>
                  <Button
                    size="custom"
                    type="button"
                    class={secondary}
                    aria-label={m.partner_link_remove({ n: index + 1 })}
                    onclick={() => removeLink(index)}
                  >
                    <span aria-hidden="true">×</span>
                  </Button>
                </div>
              </li>
            {/each}
          </ul>
          <div>
            <Button
              size="custom"
              type="button"
              class={secondary}
              disabled={!canAdd}
              bind:element={addButton}
              onclick={addLink}
            >
              {m.partner_link_add()}
            </Button>
          </div>
          <p class="sr-only" role="status">{announcement}</p>
        </fieldset>
      </div>
    </section>

    <section aria-labelledby="exchange-section" class={card}>
      <h2 id="exchange-section" class="mb-2 text-2xl font-semibold tracking-tight">
        {m.partner_form_exchange()}
      </h2>
      <p class="mb-6 text-muted">{m.partner_form_exchange_hint()}</p>
      <div class="grid gap-6">
        <div class="grid gap-1">
          <p class="label-text font-semibold">{m.partner_our_link()}</p>
          <div class="flex items-center justify-between gap-2">
            <code class="min-w-0 truncate font-mono text-sm">{OUR_LINK}</code>
            <Button
              size="custom"
              type="button"
              class={secondary}
              onclick={() => void copyOurLink()}
            >
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
      </div>
    </section>

    <section aria-labelledby="coupon-section" class={card}>
      <h2
        id="coupon-section"
        class="mb-2 flex items-center gap-2 text-2xl font-semibold tracking-tight"
      >
        <Icon name="ticket-percent" size={28} />{m.partner_form_coupon()}
      </h2>
      <p class="mb-6 text-muted">{m.partner_form_coupon_hint()}</p>
      <div class="grid gap-6">
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
      </div>
    </section>

    <div class="flex flex-wrap items-center gap-5">
      <SubmitButton
        submitting={controller.pending}
        delayed={controller.delayed}
        timeout={controller.timeout}
        class="btn h-12 rounded-lg preset-filled-primary-500 px-7 font-semibold"
        >{editing ? m.partner_form_submit_edit() : m.partner_form_submit()}</SubmitButton
      >
      <a href={localizedHref('/partners', locale)} class="link-underline font-semibold text-link"
        >{m.form_cancel()}</a
      >
    </div>
    <p class="text-sm text-muted">{m.partner_form_review_note()}</p>
  </div>

  <aside aria-labelledby="preview-title" class="lg:sticky lg:top-6 lg:self-start">
    <p id="preview-title" class="text-sm font-bold tracking-wider text-muted uppercase">
      {m.form_preview()}
    </p>
    <!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
    <div class="mt-3" inert>
      <PartnerCard partner={preview} />
    </div>
  </aside>
</Form>
