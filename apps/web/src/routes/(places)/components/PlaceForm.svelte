<script lang="ts">
  // "Cadastrar lugar" and "Editar lugar": the same form. What the place is, where it is (the CEP
  // gives the neighbourhood, city and state), when it opens and what it offers, a photo and links.
  // The card it will have sits beside it (below it on a phone), with the tags its address, kind and
  // picked tags make. An admin approves what is sent; an edit by whoever sent it goes back to them.
  import CepLookup from '#lib/components/CepLookup.svelte';
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import EditorForm from '#lib/components/ui/EditorForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import ImageUpload from '#lib/components/ui/ImageUpload.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import NetworkLinksField from '#lib/components/ui/NetworkLinksField.svelte';
  import RadioCards from '#lib/components/ui/RadioCards.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import type { SelectItem } from '#lib/components/ui/select.svelte.js';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import PlaceCard from '#lib/components/directory/ui/PlaceCard.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult, type FormResult } from '#lib/forms/contract.js';
  import { fieldErrors, problem } from '#lib/forms/field-errors.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { networkLabels } from '#lib/profile/social-presentation.js';
  import { placeKindIcons, placeKindLabels, placeTagLabel } from '#lib/places/labels.js';
  import { errorText, formProblem } from '#lib/tables/form-values.js';
  import { toast } from '#lib/toaster.js';
  import type { CepPlace } from '@mesaaberta/core/location/cep';
  import { PARTNER_NETWORKS } from '@mesaaberta/core/partners/schema';
  import { placeSchema } from '@mesaaberta/core/places/schema';
  import { MAX_PLACE_FEATURES } from '@mesaaberta/core/places/features';
  import { placeTags } from '@mesaaberta/core/places/tags';
  import { pickName } from '@mesaaberta/core/tables/catalog';
  import {
    isPlaceKind,
    MAX_PLACE_LINKS,
    PLACE_KINDS,
    PLACE_LIMITS,
  } from '@mesaaberta/core/places/types';

  type Values = {
    name: string;
    kind: string;
    postalCode: string;
    street: string;
    complement: string;
    description: string;
    openingHours: string;
    tags: string[];
    siteUrl: string;
    linkNetwork: string[];
    linkUrl: string[];
    removeImage: boolean;
    image?: File;
  };

  let {
    initial,
    mode,
    imageUrl = null,
    reviewAgain = true,
    approved = false,
    cancelHref = '/places',
    action,
    tagOptions,
    catalog = false,
  }: {
    initial: FormResult<Values>;
    mode: 'new' | 'edit';
    /** The photo the place has now (when editing). */
    imageUrl?: string | null;
    /** Saving this edit sends the place back to the queue (whoever sent it, not an admin or owner). */
    reviewAgain?: boolean;
    /** The place is up now, so saving would take it off the list. */
    approved?: boolean;
    cancelHref?: string;
    /** The action it posts to: the page's default one unless named (`?/save` on the edit page). */
    action?: string;
    /** What Tags offers: the catalog (with the person's own suggestions waiting) and what it has. */
    tagOptions: SelectItem[];
    /**
     * The whole catalog, searched, with suggestions (`use_place_tags`). Off, the six old
     * Comodidades as pills.
     */
    catalog?: boolean;
  } = $props();

  const editing = $derived(mode === 'edit');

  // svelte-ignore state_referenced_locally
  const controller = actionForm<Values>({
    ...fromResult(initial),
    schema: placeSchema,
    onSuccess: () => toast.success(m.place_form_sent()),
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
    invalid_format: m.partner_err_invalid_url,
    invalid_link: m.partner_err_invalid_link,
    invalid_network: m.partner_err_invalid_link,
    duplicate: m.partner_err_duplicate,
    too_many: () => m.partner_err_too_many({ max: MAX_PLACE_LINKS }),
  };
  const say = (code: string | undefined, field = '') =>
    code ? (codes[code]?.() ?? errorText(code, field)) : undefined;
  // Too many tags is its own limit, not the links'.
  const tagsError = $derived(
    controller.errors.tags?.[0] === 'too_many'
      ? m.place_err_too_many_tags({ max: MAX_PLACE_FEATURES })
      : say(controller.errors.tags?.[0], 'tags'),
  );
  const errors = fieldErrors<keyof Values>(controller, say);
  const { err } = errors;
  const kindError = $derived(controller.errors.kind?.[0] ? m.place_err_kind() : undefined);
  const postalCodeError = $derived(
    controller.errors.postalCode?.[0]
      ? errorText(controller.errors.postalCode[0], 'postalCode')
      : undefined,
  );
  const imageError = $derived(errors.withMessage('image'));
  const rowErrors = (index: number) => ({
    url: say(controller.errors[`linkUrl.${index}`]?.[0]),
    network: say(controller.errors[`linkNetwork.${index}`]?.[0]),
  });
  // The same name at the same CEP: the banner links to the place that is already there.
  const duplicate = $derived(controller.message?.code === 'place_duplicate');
  const formError = $derived(duplicate ? null : formProblem(controller.message));

  const problems = $derived(
    errors.summary(
      [
        ['name', m.place_form_name()],
        ['description', m.place_form_description()],
        ['street', m.place_form_street()],
        ['complement', m.place_form_complement()],
        ['openingHours', m.place_form_hours()],
        ['siteUrl', m.partner_form_site()],
      ],
      problem('tags', catalog ? m.place_form_tags_field() : m.place_form_amenities(), tagsError),
      problem('kind', m.place_form_kind(), kindError),
      problem('postalCode', m.form_postal_code(), postalCodeError),
      problem('image', m.form_image(), imageError),
    ),
  );

  // --- the networks: the same list as a partner's ----------------------------------------------------

  const networks = PARTNER_NETWORKS.map((network) => ({
    name: networkLabels[network](),
    slug: network,
  }));

  // --- the preview ---------------------------------------------------------------------------------

  // Where the CEP is, once it is found: the card's area and the location tags.
  let located = $state<CepPlace | null>(null);
  // The picked file is shown as it will look; until one is picked, the photo the place has now.
  let picked = $state<string | null>(null);
  function pick(files: File[]) {
    if (picked) URL.revokeObjectURL(picked);
    picked = files[0] ? URL.createObjectURL(files[0]) : null;
    controller.change('image', files[0]);
    controller.validateField('image');
  }

  const kind = $derived(isPlaceKind($draft.kind) ? $draft.kind : 'other');
  // A suggestion only counts once an admin approves it; the preview shows what the page will.
  const features = $derived(
    $draft.tags
      .filter((pick) => tagOptions.some((option) => option.slug === pick && !option.pending))
      .map((slug) => ({ slug, name: pickName(tagOptions, slug) })),
  );
  const card = $derived({
    slug: 'preview',
    name: $draft.name || m.place_form_name(),
    kind,
    neighbourhood: located?.neighbourhood ?? null,
    city: located?.city ?? m.place_form_city_pending(),
    state: located?.state ?? '··',
    description: $draft.description || null,
    features,
    imageUrl: picked ?? ($draft.removeImage ? null : imageUrl),
    openTables: 0,
  });
  const tags = $derived(
    located && isPlaceKind($draft.kind)
      ? placeTags({ ...located, kind: $draft.kind, features })
      : [],
  );

  const input = 'input h-13 rounded-lg border-control border-ink-muted bg-panel px-3';
  const kindOptions = PLACE_KINDS.map((value) => ({
    value,
    label: placeKindLabels[value](),
    icon: placeKindIcons[value],
  }));
</script>

<!-- No `required`, `min`, `max` or `type=url` on the inputs: the browser would check them first, in its
     own words, and show validation in the same translated messages as the server. -->
<EditorForm
  {action}
  {controller}
  {problems}
  banner={formError}
  {cancelHref}
  note={editing && !reviewAgain ? undefined : m.place_form_review_note()}
>
  {#if duplicate}
    <div
      role="alert"
      class="flex flex-wrap items-center gap-3 rounded-lg border border-warning-500 bg-panel p-4"
    >
      <p class="min-w-0 flex-1 font-semibold">{m.place_err_duplicate()}</p>
      {#if controller.message?.href}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the action built the place's path -->
        <a
          href={controller.message.href}
          class="font-semibold text-link underline underline-offset-4"
          >{m.place_err_duplicate_see()}</a
        >
      {/if}
    </div>
  {/if}
  {#if editing && reviewAgain && approved}
    <p role="note" class="rounded-lg border border-warning-500 bg-panel p-4">
      {m.place_form_edit_notice()}
    </p>
  {/if}

  <FormSection id="about-section" step={1} title={m.place_form_about()}>
    <FormField
      id="name"
      label={m.place_form_name()}
      error={err('name')}
      counter={{ count: $draft.name.length, max: PLACE_LIMITS.name }}
    >
      {#snippet children(aria)}
        <TextInput
          id="name"
          name="name"
          maxlength={PLACE_LIMITS.name}
          bind:value={$draft.name}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    <RadioCards
      name="kind"
      legend={m.place_form_kind()}
      options={kindOptions}
      bind:group={$draft.kind}
      error={kindError}
    />
    <FormField
      id="description"
      label={m.place_form_description()}
      optional
      hint={m.place_form_description_hint()}
      error={err('description')}
      counter={{ count: $draft.description.length, max: PLACE_LIMITS.description }}
    >
      {#snippet children(aria)}
        <MATextArea
          id="description"
          name="description"
          rows={3}
          maxlength={PLACE_LIMITS.description}
          bind:value={$draft.description}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  <FormSection id="address-section" step={2} title={m.place_form_address()}>
    <p role="note" class="flex items-start gap-2 rounded-lg bg-surface-wash p-4 text-sm">
      {m.place_form_public_notice()}
    </p>
    <div>
      <FormField
        id="postalCode"
        label={m.form_postal_code()}
        hint={m.place_form_cep_hint()}
        error={postalCodeError}
      >
        {#snippet children(aria)}
          <TextInput
            id="postalCode"
            name="postalCode"
            inputmode="numeric"
            autocomplete="postal-code"
            maxlength={10}
            placeholder="00000-000"
            bind:value={$draft.postalCode}
            class="{input} max-w-48"
            {...aria}
          />
        {/snippet}
      </FormField>
      <CepLookup value={$draft.postalCode} bind:place={located} />
    </div>
    <FormField
      id="street"
      label={m.place_form_street()}
      error={err('street')}
      counter={{ count: $draft.street.length, max: PLACE_LIMITS.street }}
    >
      {#snippet children(aria)}
        <TextInput
          id="street"
          name="street"
          autocomplete="address-line1"
          maxlength={PLACE_LIMITS.street}
          bind:value={$draft.street}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    <FormField
      id="complement"
      label={m.place_form_complement()}
      optional
      error={err('complement')}
      counter={{ count: $draft.complement.length, max: PLACE_LIMITS.complement }}
    >
      {#snippet children(aria)}
        <TextInput
          id="complement"
          name="complement"
          autocomplete="address-line2"
          maxlength={PLACE_LIMITS.complement}
          bind:value={$draft.complement}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  <FormSection id="hours-section" step={3} title={m.place_form_open()}>
    <FormField
      id="openingHours"
      label={m.place_form_hours()}
      optional
      hint={m.place_form_hours_hint()}
      error={err('openingHours')}
      counter={{ count: $draft.openingHours.length, max: PLACE_LIMITS.openingHours }}
    >
      {#snippet children(aria)}
        <TextInput
          id="openingHours"
          name="openingHours"
          maxlength={PLACE_LIMITS.openingHours}
          bind:value={$draft.openingHours}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    {#if catalog}
      <div class="min-w-0">
        <SearchSelect
          id="tags"
          search
          name="tags"
          label={m.place_form_tags_field()}
          labelClass="label-text block font-semibold"
          class="flex flex-col gap-1"
          items={tagOptions}
          multiple
          value={$draft.tags}
          placeholder={m.form_catalog_search()}
          invalid={!!tagsError}
          suggestLabel={(name) => m.form_catalog_suggest({ name })}
          pendingLabel={m.form_catalog_pending()}
          onchange={(picked) => ($draft.tags = picked)}
        />
        <p class="mt-1 text-sm text-surface-700-300">{m.place_form_tags_hint()}</p>
        <FieldError id="tags" message={tagsError} />
      </div>
    {:else}
      <CheckboxPills
        name="tags"
        legend={m.place_form_amenities()}
        hint={m.place_form_amenities_hint()}
        options={tagOptions.map((option) => ({ value: option.slug, label: option.name }))}
        bind:group={$draft.tags}
        error={tagsError}
      />
    {/if}
  </FormSection>

  <FormSection id="photo-section" step={4} title={m.place_form_photo_links()}>
    <ImageUpload
      id="image"
      name="image"
      label="{m.form_image()} ({m.form_optional()})"
      hint={imageUrl ? m.form_image_current() : m.place_form_photo_hint()}
      error={imageError}
      currentUrl={imageUrl}
      bind:removed={$draft.removeImage}
      onpick={pick}
    />
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
      max={MAX_PLACE_LINKS}
      idPrefix="place-link"
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
      buttonClass="btn h-11 rounded-lg btn-secondary px-4 font-semibold"
    />
  </FormSection>

  {#snippet actions()}
    <MAButton
      type="submit"
      size="custom"
      {controller}
      class="btn h-12 gap-2 rounded-lg preset-filled-primary-500 px-7 font-semibold"
      >{editing ? m.place_form_submit_edit() : m.place_form_submit()}</MAButton
    >
  {/snippet}
  {#snippet preview()}
    <PlaceCard place={card} />
  {/snippet}
  {#snippet details()}
    {#if !editing || reviewAgain}
      <p class="mt-3 text-sm font-semibold text-warning-700-300">{m.place_form_pending()}</p>
    {/if}
    <section aria-labelledby="place-tags-title" class="mt-6">
      <h2 id="place-tags-title" class="text-sm font-bold tracking-wider text-muted uppercase">
        {m.place_form_tags()}
      </h2>
      {#if tags.length > 0}
        <ul class="mt-3 flex flex-wrap gap-2">
          {#each tags as tag (tag.kind + tag.slug)}
            <li
              class="inline-flex h-8 items-center rounded-full border border-surface-200-800 px-3 text-sm font-semibold"
            >
              {placeTagLabel(tag)}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="mt-2 text-sm text-muted">{m.place_form_tags_empty()}</p>
      {/if}
    </section>
  {/snippet}
</EditorForm>
