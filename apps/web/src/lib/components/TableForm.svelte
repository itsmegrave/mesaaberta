<script lang="ts">
  import TextInput from '#lib/components/TextInput.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { modalityIcon } from '#lib/tables/modality-icon.js';
  import CepLookup from './CepLookup.svelte';
  import FormBanner from '#lib/components/FormBanner.svelte';
  import SubmitButton from '#lib/components/SubmitButton.svelte';
  import { NEW_CATALOG_PREFIX } from '@mesaaberta/core/tables/catalog';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import Form from './Form.svelte';
  import { NAMELESS } from '@mesaaberta/core/profile/handle';
  import FormField from './FormField.svelte';
  import ErrorSummary from './ErrorSummary.svelte';
  import RichTextField from './RichTextField.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import SeatSlider from './SeatSlider.svelte';
  import DateTimeField from './DateTimeField.svelte';
  import SessionPicker from './SessionPicker.svelte';
  import ImageUpload from './ImageUpload.svelte';
  import { errorText, formProblem, type TableFormValues } from '#lib/tables/form-values.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { formatHours, zonedToDate } from '@mesaaberta/core/tables/format';
  import { TABLE_LIMITS } from '@mesaaberta/core/tables/schema';
  import { pickName } from '@mesaaberta/core/tables/catalog';

  type CatalogPick = { name: string; slug: string; pending?: true };
  import TableCard from './TableCard.svelte';

  type Props = {
    controller: ReturnType<typeof actionForm<TableFormValues>>;
    systems: { name: string; slug: string; pending?: true }[];
    /** The platforms and tags a table can pick: approved, and the GM's own pending ones. */
    catalog: { platforms: CatalogPick[]; tags: CatalogPick[] };
    submitLabel: string;
    /** A new table: offers a second button that saves it without going public. */
    draftLabel?: string;
    /** A new table or a draft: a system the list lacks can be suggested. */
    suggestSystem?: boolean;
    imageUrl?: string | null;
    action?: string;
    duplicationRequestKey?: string;
    /** Where "Cancelar" goes: the list for a new table, the table itself when editing. */
    cancelHref?: string;
    /** Shown as the GM on the preview card. */
    gmName?: string;
    /** The fewest seats the slider allows: the seats already taken, when editing. */
    minCapacity?: number;
    /** Editing: where the GM removes players, offered when seats are taken. */
    manageHref?: string;
    /** Editing: say that saving sends the updated calendar invite. */
    calendarNote?: boolean;
  };

  let {
    controller,
    systems,
    catalog,
    submitLabel,
    draftLabel,
    suggestSystem = false,
    imageUrl = null,
    action,
    duplicationRequestKey,
    cancelHref = '/t',
    gmName = NAMELESS,
    minCapacity = TABLE_LIMITS.capacity.min,
    manageHref,
    calendarNote = false,
  }: Props = $props();
  // svelte-ignore state_referenced_locally
  const { draft } = controller;
  // A suggested system: one typed just now, or one of the GM's that no admin approved yet.
  const systemWaits = $derived(
    $draft.systemSlug.startsWith(NEW_CATALOG_PREFIX) ||
      systems.some((system) => system.slug === $draft.systemSlug && system.pending),
  );
  // "GMT-3": the zone's offset at the first session, or now until one is typed.
  const zoneOffset = $derived(
    new Intl.DateTimeFormat('pt-BR', { timeZone: $draft.timezone, timeZoneName: 'shortOffset' })
      .formatToParts(zonedToDate($draft.startsAtLocal, $draft.timezone) ?? new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? '',
  );
  // Today where the GM is: the first day a session can be.
  const today = $derived(new Date().toLocaleDateString('sv-SE', { timeZone: $draft.timezone }));
  const previewSystem = $derived(
    systems.find((system) => system.slug === $draft.systemSlug)?.name ?? m.form_system(),
  );

  // The card the list will show, from what is typed so far.
  const preview = $derived({
    slug: 'preview',
    title: $draft.title || m.form_preview_title(),
    kind: $draft.kind,
    system: { name: previewSystem },
    gmName,
    capacity: Number($draft.capacity) || 1,
    seatsLeft: Number($draft.capacity) || 1,
    timezone: $draft.timezone,
    startsAt: zonedToDate($draft.startsAtLocal, $draft.timezone),
    imageUrl,
    modality: $draft.modality,
    locationArea: $draft.locationArea || null,
    platforms: $draft.platforms.map((pick) => pickName(catalog.platforms, pick)),
    tags: $draft.tags.map((pick) => pickName(catalog.tags, pick)),
  });
  // A plain field's errors are a list; a list field's (platforms, tags) are under `_errors`.
  const firstError = (value: unknown): string | undefined =>
    Array.isArray(value)
      ? (value[0] as string | undefined)
      : ((value as { _errors?: string[] } | undefined)?._errors?.[0] ?? undefined);
  const err = (field: keyof TableFormValues) => {
    const code = firstError(controller.errors[field]);
    return code ? errorText(code, field) : undefined;
  };
  const imageError = $derived(
    err('image') ??
      (controller.message?.field === 'image'
        ? errorText(controller.message.code, 'image')
        : undefined),
  );
  const invalid = (field: keyof TableFormValues) =>
    firstError(controller.errors[field]) ? 'true' : undefined;
  const problem = $derived(formProblem(controller.message));
  // Each invalid field, in the order the form asks for them, for the summary at the top.
  const summary = $derived(
    (
      [
        ['systemSlug', m.form_system()],
        ['title', m.form_title()],
        ['platforms', m.form_platforms()],
        ['tags', m.form_tags()],
        ['description', m.form_description()],
        ['extraInfo', m.form_extra_info()],
        ['welcomeMessage', m.form_welcome_message()],
        ['kind', m.form_kind()],
        ['startsAtLocal', m.form_starts_at()],
        ['durationHours', m.session_duration()],
        ['repeat', m.form_repeat()],
        ['until', m.form_until()],
        ['postalCode', m.form_postal_code()],
        ['locationArea', m.form_location_area()],
        ['joinDetails', m.form_join_details_link()],
        ['capacity', m.form_capacity()],
        ['minPlayers', m.form_min_players()],
      ] as const
    ).flatMap(([field, label]) => {
      const message = err(field);
      return message ? [{ id: field, label, message }] : [];
    }),
  );
  const problems = $derived(
    imageError
      ? [...summary, { id: 'image', label: m.form_image(), message: imageError }]
      : summary,
  );
</script>

<Form
  {action}
  enctype="multipart/form-data"
  onsubmit={controller.submit}
  onfocusout={controller.blur}
  class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12"
>
  {#if duplicationRequestKey}<input
      type="hidden"
      name="duplicationRequestKey"
      value={duplicationRequestKey}
    />{/if}
  <div class="grid gap-8 lg:col-span-2">
    <ErrorSummary errors={problems} />
    <FormBanner text={problem} />

    <section
      aria-labelledby="about-table"
      class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
    >
      <div class="mb-6 flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
          aria-hidden="true">1</span
        >
        <h2 id="about-table" class="text-2xl font-semibold tracking-tight">Sobre a mesa</h2>
      </div>
      <div class="grid gap-6">
        <div class="min-w-0">
          <SearchSelect
            id="systemSlug"
            name="systemSlug"
            label={m.form_system()}
            labelClass="label-text block font-semibold"
            class="grid gap-1"
            items={systems}
            value={$draft.systemSlug ? [$draft.systemSlug] : []}
            placeholder={m.form_system_choose()}
            required
            invalid={!!invalid('systemSlug')}
            onchange={(picked) => ($draft.systemSlug = picked[0] ?? '')}
            suggestLabel={suggestSystem ? (name) => m.form_catalog_suggest({ name }) : undefined}
            pendingLabel={m.form_catalog_pending()}
          />
          {#if systemWaits}
            <p class="mt-1 text-sm text-muted">{m.form_system_waiting_hint()}</p>
          {/if}
          {#if err('systemSlug')}<p
              id="systemSlug-error"
              role="alert"
              class="mt-1 text-sm font-semibold text-error-700-300"
            >
              {err('systemSlug')}
            </p>{/if}
        </div>
        <FormField
          id="title"
          label={m.form_title()}
          error={err('title')}
          counter={{ count: $draft.title.length, max: TABLE_LIMITS.title.max }}
        >
          {#snippet children(aria)}
            <TextInput
              id="title"
              name="title"
              required
              minlength={3}
              maxlength={80}
              bind:value={$draft.title}
              class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
              {...aria}
            />
          {/snippet}
        </FormField>
        {#each [{ field: 'platforms', label: m.form_platforms(), hint: m.form_platforms_hint(), items: catalog.platforms }, { field: 'tags', label: m.form_tags(), hint: m.form_tags_hint(), items: catalog.tags }] as const as group (group.field)}
          <div class="min-w-0">
            <SearchSelect
              id={group.field}
              name={group.field}
              label={group.label}
              labelClass="label-text block font-semibold"
              class="flex flex-col gap-1"
              items={group.items}
              multiple
              value={$draft[group.field]}
              placeholder={m.form_catalog_search()}
              invalid={!!invalid(group.field)}
              suggestLabel={(name) => m.form_catalog_suggest({ name })}
              pendingLabel={m.form_catalog_pending()}
              onchange={(picked) => ($draft[group.field] = picked)}
            />
            <p class="mt-1 text-sm text-surface-700-300">{group.hint}</p>
            {#if err(group.field)}<p
                role="alert"
                class="mt-1 text-sm font-semibold text-error-700-300"
              >
                {err(group.field)}
              </p>{/if}
          </div>
        {/each}
        <FormField
          id="description"
          label={m.form_description()}
          optional
          error={err('description')}
          counter={{ count: $draft.description.length, max: TABLE_LIMITS.description }}
        >
          <RichTextField
            id="description"
            name="description"
            rows={5}
            maxlength={TABLE_LIMITS.description}
            bind:value={$draft.description}
            invalid={invalid('description')}
          />
        </FormField>
        <FormField
          id="extraInfo"
          label={m.form_extra_info()}
          optional
          counter={{ count: $draft.extraInfo.length, max: TABLE_LIMITS.extraInfo }}
          hint={m.form_extra_info_hint()}
          error={err('extraInfo')}
        >
          <RichTextField
            id="extraInfo"
            name="extraInfo"
            rows={3}
            maxlength={TABLE_LIMITS.extraInfo}
            bind:value={$draft.extraInfo}
            invalid={invalid('extraInfo')}
          />
        </FormField>
        <FormField
          id="welcomeMessage"
          label={m.form_welcome_message()}
          optional
          counter={{ count: $draft.welcomeMessage.length, max: TABLE_LIMITS.welcomeMessage }}
          hint={m.form_welcome_message_hint({ token: '{nome da mesa}' })}
          error={err('welcomeMessage')}
        >
          <RichTextField
            id="welcomeMessage"
            name="welcomeMessage"
            rows={4}
            maxlength={TABLE_LIMITS.welcomeMessage}
            bind:value={$draft.welcomeMessage}
            invalid={invalid('welcomeMessage')}
          />
        </FormField>
      </div>
    </section>

    <section
      aria-labelledby="when"
      class="grid gap-6 rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
    >
      <div class="flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
          aria-hidden="true">2</span
        >
        <h2 id="when" class="text-2xl font-semibold tracking-tight">Quando</h2>
      </div>
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_kind()}</legend>
        {#each [['one_shot', m.form_kind_one_shot()], ['campaign', m.form_kind_campaign()], ['adventure', m.form_kind_adventure()]] as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10"
            ><input type="radio" name="kind" {value} bind:group={$draft.kind} />{label}</label
          >{/each}
        {#if controller.errors.kind}<p
            role="alert"
            class="text-sm font-semibold text-error-700-300"
          >
            {err('kind')}
          </p>{/if}
      </fieldset>
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="min-w-0 sm:col-span-2">
          <SessionPicker
            bind:startsAt={$draft.startsAtLocal}
            bind:duration={$draft.durationHours}
            timezone={$draft.timezone}
            min={today}
            invalid={!!invalid('startsAtLocal') || !!invalid('durationHours')}
            describedby={err('startsAtLocal') ? 'startsAtLocal-error' : undefined}
          />
          {#each ['startsAtLocal', 'durationHours'] as const as field (field)}
            {#if err(field)}<p
                id="{field}-error"
                role="alert"
                class="mt-1 text-sm font-semibold text-error-700-300"
              >
                {err(field)}
              </p>{/if}
          {/each}
        </div>
        <div class="min-w-0 sm:col-span-2">
          <input type="hidden" name="timezone" value={$draft.timezone} />
          <p class="text-sm text-surface-700-300">
            {m.form_timezone_note({
              zone: $draft.timezone.replaceAll('_', ' '),
              offset: zoneOffset,
            })}
            <a href="/u/profile/edit/about" class="anchor">{m.form_timezone_change()}</a>
          </p>
          {#if calendarNote}<p class="mt-2 text-sm text-surface-700-300">
              {m.form_edit_calendar_note()}
            </p>{/if}
        </div>
      </div>
      {#if $draft.kind === 'campaign'}
        <div class="grid gap-6 sm:grid-cols-2">
          <div class="min-w-0">
            <SearchSelect
              id="repeat"
              name="repeat"
              label={m.form_repeat()}
              labelClass="label-text block font-semibold"
              class="grid gap-1"
              items={[
                { name: m.form_repeat_weekly(), slug: 'weekly' },
                { name: m.form_repeat_biweekly(), slug: 'biweekly' },
              ]}
              value={[$draft.repeat]}
              placeholder={m.form_repeat()}
              invalid={!!invalid('repeat')}
              onchange={(picked) =>
                ($draft.repeat = picked[0] === 'biweekly' ? 'biweekly' : 'weekly')}
            />
            {#if err('repeat')}<p
                id="repeat-error"
                role="alert"
                class="mt-1 text-sm font-semibold text-error-700-300"
              >
                {err('repeat')}
              </p>{/if}
          </div>
          <div class="min-w-0">
            <DateTimeField
              id="until"
              name="until"
              label={m.form_until()}
              hint={m.form_until_hint()}
              min={$draft.startsAtLocal.slice(0, 10) || today}
              bind:value={$draft.until}
              invalid={!!invalid('until')}
              describedby={['until-hint', err('until') ? 'until-error' : ''].join(' ').trim()}
            />
            {#if err('until')}<p
                id="until-error"
                role="alert"
                class="mt-1 text-sm font-semibold text-error-700-300"
              >
                {err('until')}
              </p>{/if}
          </div>
        </div>
      {/if}
    </section>

    <section
      aria-labelledby="seats-entry"
      class="grid gap-6 rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
    >
      <div class="flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
          aria-hidden="true">3</span
        >
        <h2 id="seats-entry" class="text-2xl font-semibold tracking-tight">Vagas e entrada</h2>
      </div>
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_modality()}</legend
        >{#each [['online', m.table_modality_online()], ['in_person', m.table_modality_in_person()]] as const as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10"
            ><input type="radio" name="modality" {value} bind:group={$draft.modality} /><Icon
              name={modalityIcon(value)}
              size={20}
            />{label}</label
          >{/each}
      </fieldset>
      {#if $draft.modality === 'in_person'}
        <FormField
          id="postalCode"
          label={m.form_postal_code()}
          hint={m.form_postal_code_hint()}
          error={err('postalCode')}
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
              class="input h-12 max-w-48 rounded-lg border-surface-200-800 bg-panel px-3"
              {...aria}
            />
          {/snippet}
        </FormField>
        <CepLookup value={$draft.postalCode} bind:area={$draft.locationArea} />
        <FormField
          id="locationArea"
          label={m.form_location_area()}
          hint={$draft.postalCode ? m.form_location_area_hint_cep() : m.form_location_area_hint()}
          error={err('locationArea')}
        >
          {#snippet children(aria)}
            <TextInput
              id="locationArea"
              name="locationArea"
              maxlength={120}
              autocomplete="off"
              bind:value={$draft.locationArea}
              class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
              {...aria}
            />
          {/snippet}
        </FormField>
      {/if}
      <FormField
        id="joinDetails"
        label={$draft.modality === 'in_person'
          ? m.form_join_details_place()
          : m.form_join_details_link()}
        hint={m.form_join_details_hint()}
        error={err('joinDetails')}
        counter={{ count: $draft.joinDetails.length, max: TABLE_LIMITS.joinDetails }}
        ><RichTextField
          id="joinDetails"
          name="joinDetails"
          rows={3}
          maxlength={TABLE_LIMITS.joinDetails}
          bind:value={$draft.joinDetails}
          invalid={invalid('joinDetails')}
        /></FormField
      >
      <div class="min-w-0">
        <SeatSlider
          id="capacity"
          name="capacity"
          label={m.form_capacity()}
          bind:value={$draft.capacity}
          min={minCapacity}
          max={TABLE_LIMITS.capacity.max}
          invalid={!!invalid('capacity')}
          describedby={[
            minCapacity > 1 ? 'capacity-taken' : '',
            err('capacity') ? 'capacity-error' : '',
          ]
            .join(' ')
            .trim() || undefined}
        />
        {#if minCapacity > 1}<p id="capacity-taken" class="mt-1 text-sm text-surface-700-300">
            {m.form_capacity_taken({ count: minCapacity })}
            {#if manageHref}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
              <a href={manageHref} class="anchor">{m.form_capacity_remove_players()}</a>
            {/if}
          </p>{/if}
        {#if err('capacity')}<p
            id="capacity-error"
            role="alert"
            class="mt-1 text-sm font-semibold text-error-700-300"
          >
            {err('capacity')}
          </p>{/if}
      </div>
      <FormField
        id="minPlayers"
        label={m.form_min_players()}
        optional
        hint={m.form_min_players_hint()}
        error={err('minPlayers')}
      >
        {#snippet children(aria)}
          <TextInput
            id="minPlayers"
            name="minPlayers"
            inputmode="numeric"
            autocomplete="off"
            maxlength={2}
            bind:value={$draft.minPlayers}
            class="input h-12 max-w-32 rounded-lg border-surface-200-800 bg-panel px-3"
            {...aria}
          />
        {/snippet}
      </FormField>
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_join_mode()}</legend
        >{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/10"
            ><input
              type="radio"
              name="joinMode"
              {value}
              bind:group={$draft.joinMode}
            />{label}</label
          >{/each}
      </fieldset>
    </section>

    <section
      aria-labelledby="image-section"
      class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
    >
      <div class="mb-6 flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
          aria-hidden="true">4</span
        >
        <h2 id="image-section" class="text-2xl font-semibold tracking-tight">Imagem</h2>
      </div>
      <ImageUpload
        id="image"
        name="image"
        label="{m.form_image()} ({m.form_optional()})"
        hint={imageUrl ? m.form_image_current() : m.form_image_hint()}
        error={imageError}
        currentUrl={imageUrl}
        bind:removed={$draft.removeImage}
        onpick={(files) => {
          controller.change('image', files[0]);
          controller.validateField('image');
        }}
      />
    </section>
    <div class="flex flex-wrap items-center gap-5">
      <SubmitButton
        submitting={controller.pending}
        delayed={controller.delayed}
        timeout={controller.timeout}
        class="btn h-12 rounded-lg preset-filled-primary-500 px-7 font-semibold"
        >{submitLabel}</SubmitButton
      >
      {#if draftLabel}
        <SubmitButton
          name="intent"
          value="draft"
          submitting={controller.pending}
          class="btn h-12 rounded-lg border-2 border-surface-200-800 px-5 font-semibold hover:preset-tonal"
          >{draftLabel}</SubmitButton
        >
      {/if}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
      <a href={cancelHref} class="link-underline font-semibold text-link">{m.form_cancel()}</a>
    </div>
  </div>
  <aside aria-labelledby="preview-title" class="lg:sticky lg:top-6 lg:self-start">
    <p id="preview-title" class="text-sm font-bold tracking-wider text-muted uppercase">
      {m.form_preview()}
    </p>
    <!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
    <div class="mt-3" inert>
      <TableCard table={preview} />
    </div>
    <ul class="mt-4 grid gap-2 rounded-lg border border-surface-200-800 bg-panel p-5 text-sm">
      <li class="flex items-center gap-2">
        <Icon name={modalityIcon($draft.modality)} size={16} />
        {$draft.modality === 'in_person'
          ? `${m.table_modality_in_person()}${$draft.locationArea ? ` · ${$draft.locationArea}` : ''}`
          : m.table_modality_online()}
      </li>
      <li>
        {$draft.kind === 'campaign'
          ? $draft.repeat === 'biweekly'
            ? m.form_repeat_biweekly()
            : m.form_repeat_weekly()
          : m.table_recurrence_once()}, {formatHours(
          (Number($draft.durationHours) || 0) * 60,
          getLocale(),
        )}
      </li>
      <li>{$draft.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}</li>
    </ul>
  </aside>
</Form>
