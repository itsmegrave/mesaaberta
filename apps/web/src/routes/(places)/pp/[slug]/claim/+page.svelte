<script lang="ts">
  // "Este lugar é seu?": who the member is at the place, how the team reaches them to check, and
  // that they speak for it. An admin approves; then they manage the page and it shows "Verificado".
  import Breadcrumbs from '#lib/components/ui/Breadcrumbs.svelte';
  import ErrorSummary from '#lib/components/ui/ErrorSummary.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import RadioCards from '#lib/components/ui/RadioCards.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { fieldErrors, problem } from '#lib/forms/field-errors.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import {
    PLACE_CLAIM_LIMITS,
    PLACE_CLAIM_RELATIONS,
    placeClaimSchema,
    type PlaceClaimRelation,
  } from '@mesaaberta/core/places/claims';

  type Values = { relation: string; contact: string; note: string; confirm: boolean };

  let { data, form: result = null } = $props();
  const place = $derived(data.place);

  // svelte-ignore state_referenced_locally
  const controller = actionForm<Values>({
    ...fromResult(result?.form ?? data.form),
    schema: placeClaimSchema,
    domain: 'account',
    onSuccess: () => toast.success(m.place_claim_sent_toast()),
    errorMessage: m.form_error_unavailable,
  });
  const { draft } = controller;

  const codes: Record<string, () => string> = {
    too_small: m.form_error_required,
    too_big: m.form_error_too_big,
    too_long: m.form_error_too_big,
  };
  const say = (code: string | undefined) =>
    code ? (codes[code]?.() ?? m.form_error_required()) : undefined;
  const errors = fieldErrors<keyof Values>(controller, say);
  const { err } = errors;
  const relationError = $derived(
    controller.errors.relation?.[0] ? m.place_claim_err_role() : undefined,
  );
  const confirmError = $derived(
    controller.errors.confirm?.[0] ? m.place_claim_err_confirm() : undefined,
  );
  const problems = $derived(
    errors.summary(
      [
        ['contact', m.place_claim_contact()],
        ['note', m.place_claim_note()],
      ],
      problem('relation', m.place_claim_role(), relationError),
      problem('confirm', m.place_claim_confirm_label(), confirmError),
    ),
  );
  const banners: Record<string, () => string> = {
    place_already_owned: m.place_claim_err_owned,
    claim_pending: m.place_claim_err_pending,
    rate_limited: m.place_claim_err_rate_limited,
  };
  const code = $derived(controller.message?.code);
  const banner = $derived(
    code && code !== 'sent' && code !== 'invalid'
      ? (banners[code]?.() ?? m.form_error_unavailable())
      : null,
  );
  const sent = $derived(code === 'sent' || data.state === 'pending');

  const relationLabels: Record<PlaceClaimRelation, () => string> = {
    owner: m.place_claim_role_owner,
    staff: m.place_claim_role_staff,
    organizer: m.place_claim_role_organizer,
  };
  const relationOptions = PLACE_CLAIM_RELATIONS.map((value) => ({
    value,
    label: relationLabels[value](),
  }));
  const input = 'input h-13 rounded-lg border-control border-ink-muted bg-panel px-3';
</script>

<svelte:head><title>{m.place_claim_page_title({ name: place.name })}</title></svelte:head>

<section class="pt-2 pb-4 md:pt-12">
  <Breadcrumbs
    class="mb-8"
    items={[
      { label: m.places_crumb(), href: '/places' },
      { label: place.name, href: `/pp/${place.slug}` },
      { label: m.place_claim_crumb() },
    ]}
  />
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.place_claim_heading({ name: place.name })}
  </h1>

  {#if data.state === 'owner' || data.state === 'owned' || sent}
    <div role="status" class="mt-8 max-w-xl rounded-lg border border-surface-200-800 bg-panel p-6">
      <h2 class="text-2xl font-semibold">
        {data.state === 'owner'
          ? m.place_claim_owner_title()
          : data.state === 'owned'
            ? m.place_claim_owned_title()
            : m.place_claim_sent_title()}
      </h2>
      <p class="mt-3 text-lg">
        {data.state === 'owner'
          ? m.place_claim_owner_text()
          : data.state === 'owned'
            ? m.place_claim_owned_text()
            : m.place_claim_sent_text()}
      </p>
      <a href="/pp/{place.slug}" class="mt-6 {buttonClass('secondary', 'sm')} font-semibold"
        >{m.place_claim_back()}</a
      >
    </div>
  {:else}
    <p class="mt-2 max-w-sm text-base text-muted md:mt-3 md:max-w-lg md:text-xl">
      {m.place_claim_lede()}
    </p>
    <!-- No `required` or `minlength`: the browser would check first, in its own words. -->
    <MAForm
      onsubmit={controller.submit}
      onfocusout={controller.blur}
      class="mt-8 grid max-w-xl gap-6"
    >
      <ErrorSummary errors={problems} />
      <FormBanner text={banner} />
      <RadioCards
        name="relation"
        legend={m.place_claim_role()}
        options={relationOptions}
        bind:group={$draft.relation}
        error={relationError}
      />
      <FormField
        id="contact"
        label={m.place_claim_contact()}
        hint={m.place_claim_contact_hint()}
        error={err('contact')}
      >
        {#snippet children(aria)}
          <TextInput
            id="contact"
            name="contact"
            maxlength={PLACE_CLAIM_LIMITS.contact.max}
            bind:value={$draft.contact}
            class={input}
            {...aria}
          />
        {/snippet}
      </FormField>
      <FormField
        id="note"
        label={m.place_claim_note()}
        optional
        hint={m.place_claim_note_hint()}
        error={err('note')}
        counter={{ count: $draft.note.length, max: PLACE_CLAIM_LIMITS.note }}
      >
        {#snippet children(aria)}
          <MATextArea
            id="note"
            name="note"
            rows={3}
            maxlength={PLACE_CLAIM_LIMITS.note}
            bind:value={$draft.note}
            {...aria}
          />
        {/snippet}
      </FormField>
      <div>
        <label class="flex min-h-11 items-start gap-3">
          <input
            id="confirm"
            type="checkbox"
            name="confirm"
            value="true"
            bind:checked={$draft.confirm}
            class="mt-1 checkbox"
            aria-invalid={confirmError ? 'true' : undefined}
            aria-describedby={confirmError ? 'confirm-error' : undefined}
          />
          <span>{m.place_claim_confirm_label()}</span>
        </label>
        <FieldError id="confirm" message={confirmError} />
      </div>
      <div class="flex flex-wrap items-center gap-5">
        <MAButton type="submit" variant="primary" {controller} class="px-6 font-semibold"
          >{m.place_claim_submit()}</MAButton
        >
        <a href="/pp/{place.slug}" class="font-semibold text-link underline underline-offset-4"
          >{m.form_cancel()}</a
        >
      </div>
      <p class="text-sm text-muted">{m.place_claim_review_note()}</p>
    </MAForm>
  {/if}
</section>
