<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { modalityIcon } from '#lib/tables/modality-icon.js';
  import CepLookup from '#lib/components/CepLookup.svelte';
  import { NEW_CATALOG_PREFIX } from '@mesaaberta/core/tables/catalog';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fieldErrors, problem } from '#lib/forms/field-errors.js';
  import EditorForm from '#lib/components/ui/EditorForm.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import RadioCards from '#lib/components/ui/RadioCards.svelte';
  import { NAMELESS } from '@mesaaberta/core/profile/handle';
  import FormField from '#lib/components/ui/FormField.svelte';
  import RichTextField from '#lib/components/ui/RichTextField.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import { CONTENT_RATINGS, SAFETY_TOOLS } from '@mesaaberta/core/tables/safety';
  import { contentRatingLabel, safetyToolLabel } from '#lib/tables/safety-labels.js';
  import SegmentedChoice from '#lib/components/ui/SegmentedChoice.svelte';
  import SeatSlider from '#lib/components/ui/SeatSlider.svelte';
  import DateTimeField from '#lib/components/ui/DateTimeField.svelte';
  import SessionPicker from '#lib/components/ui/SessionPicker.svelte';
  import ImageUpload from '#lib/components/ui/ImageUpload.svelte';
  import { errorText, formProblem, type TableFormValues } from '#lib/tables/form-values.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { formatHours, zonedToDate } from '@mesaaberta/core/tables/format';
  import { TABLE_LIMITS } from '@mesaaberta/core/tables/schema';
  import { pickName } from '@mesaaberta/core/tables/catalog';
  import { placeArea } from '#lib/places/labels.js';
  import type { PlaceOption } from '@mesaaberta/core/server/places/picker';

  type CatalogPick = { name: string; slug: string; pending?: true };
  import TableCard from '#lib/components/ui/TableCard.svelte';

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
    /** The "Onde jogar" places an in-person table can pick; null while the places are off. */
    places?: PlaceOption[] | null;
    /** Safety tools and the content rating (`use_table_safety`). Off, their values ride along unseen. */
    safety?: boolean;
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
    cancelHref = '/tables',
    gmName = NAMELESS,
    minCapacity = TABLE_LIMITS.capacity.min,
    manageHref,
    calendarNote = false,
    places = null,
    safety = false,
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

  // "Onde vai ser": a listed place (its CEP and area come with it) or another one, typed as before.
  // svelte-ignore state_referenced_locally
  let where = $state<'place' | 'other'>(
    !places || (!$draft.placeSlug && ($draft.postalCode || $draft.locationArea))
      ? 'other'
      : 'place',
  );
  const placeItems = $derived(
    (places ?? []).map((place) => ({
      slug: place.slug,
      name: `${place.name} · ${placeArea(place)}`,
    })),
  );
  const picked = $derived(places?.find((place) => place.slug === $draft.placeSlug) ?? null);
  function chooseWhere(choice: string) {
    where = choice === 'place' ? 'place' : 'other';
    if (where === 'other') $draft.placeSlug = '';
  }

  // The adventure's count as typed, once it is one the form takes.
  const plannedCount = $derived(
    $draft.kind === 'adventure' && /^\d{1,2}$/.test($draft.plannedSessions)
      ? Number($draft.plannedSessions)
      : null,
  );

  // The card the list will show, from what is typed so far.
  const card = $derived({
    slug: 'preview',
    title: $draft.title || m.form_preview_title(),
    kind: $draft.kind,
    plannedSessions: plannedCount,
    system: { name: previewSystem },
    gmName,
    capacity: Number($draft.capacity) || 1,
    seatsLeft: Number($draft.capacity) || 1,
    timezone: $draft.timezone,
    startsAt: zonedToDate($draft.startsAtLocal, $draft.timezone),
    imageUrl,
    modality: $draft.modality,
    locationArea: picked ? placeArea(picked) : $draft.locationArea || null,
    placeName: picked?.name ?? null,
    platforms: $draft.platforms.map((pick) => pickName(catalog.platforms, pick)),
    tags: $draft.tags.map((pick) => pickName(catalog.tags, pick)),
  });
  const errors = fieldErrors<keyof TableFormValues>(() => controller, errorText);
  const { err, invalid } = errors;
  const imageError = $derived(errors.withMessage('image'));
  const formError = $derived(formProblem(controller.message));
  // Each invalid field, in the order the form asks for them, for the summary at the top.
  const problems = $derived(
    errors.summary(
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
        ['plannedSessions', m.form_planned_sessions()],
        ['placeSlug', m.table_form_place()],
        ['postalCode', m.form_postal_code()],
        ['locationArea', m.form_location_area()],
        ['joinDetails', m.form_join_details_link()],
        ['capacity', m.form_capacity()],
        ['minPlayers', m.form_min_players()],
      ],
      problem('image', m.form_image(), imageError),
    ),
  );
</script>

<EditorForm {action} {controller} {problems} banner={formError} {cancelHref}>
  {#if duplicationRequestKey}<input
      type="hidden"
      name="duplicationRequestKey"
      value={duplicationRequestKey}
    />{/if}

  <FormSection id="about-table" step={1} title="Sobre a mesa">
    <div class="min-w-0">
      <SearchSelect
        id="systemSlug"
        search
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
      <FieldError id="systemSlug" message={err('systemSlug')} />
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
          class="input h-11 rounded-lg border-control border-ink-muted bg-panel px-3"
          {...aria}
        />
      {/snippet}
    </FormField>
    {#each [{ field: 'platforms', label: m.form_platforms(), hint: m.form_platforms_hint(), items: catalog.platforms }, { field: 'tags', label: m.form_tags(), hint: m.form_tags_hint(), items: catalog.tags }] as const as group (group.field)}
      <div class="min-w-0">
        <SearchSelect
          id={group.field}
          search
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
        <FieldError id={group.field} message={err(group.field)} />
      </div>
    {/each}
    {#if safety}
      <CheckboxPills
        name="safetyTools"
        legend={m.form_safety_tools()}
        hint={m.form_safety_tools_hint()}
        options={SAFETY_TOOLS.map((tool) => ({ value: tool, label: safetyToolLabel(tool) }))}
        bind:group={$draft.safetyTools}
        error={err('safetyTools')}
      />
      <div class="min-w-0">
        <SearchSelect
          id="contentRating"
          name="contentRating"
          label={m.form_content_rating()}
          labelClass="label-text block font-semibold"
          class="grid gap-1"
          items={[
            { slug: '', name: m.form_content_rating_none() },
            ...CONTENT_RATINGS.map((rating) => ({
              slug: rating,
              name: contentRatingLabel(rating),
            })),
          ]}
          value={$draft.contentRating ? [$draft.contentRating] : []}
          placeholder={m.form_content_rating_none()}
          invalid={!!invalid('contentRating')}
          onchange={(picked) =>
            ($draft.contentRating = (picked[0] ?? '') as TableFormValues['contentRating'])}
        />
        <p class="mt-1 text-sm text-surface-700-300">{m.form_content_rating_hint()}</p>
        <FieldError id="contentRating" message={err('contentRating')} />
      </div>
    {:else}
      {#each $draft.safetyTools as tool (tool)}
        <input type="hidden" name="safetyTools" value={tool} />
      {/each}
      <input type="hidden" name="contentRating" value={$draft.contentRating} />
    {/if}
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
  </FormSection>

  <FormSection id="when" step={2} title="Quando">
    <RadioCards
      name="kind"
      legend={m.form_kind()}
      options={[
        { value: 'one_shot', label: m.form_kind_one_shot() },
        { value: 'campaign', label: m.form_kind_campaign() },
        { value: 'adventure', label: m.form_kind_adventure() },
      ]}
      bind:group={$draft.kind}
      error={err('kind')}
    />
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
          <FieldError id={field} message={err(field)} />
        {/each}
      </div>
      <div class="min-w-0 sm:col-span-2">
        <input type="hidden" name="timezone" value={$draft.timezone} />
        <p class="text-sm text-surface-700-300">
          {m.form_timezone_note({
            zone: $draft.timezone.replaceAll('_', ' '),
            offset: zoneOffset,
          })}
          <a href="/u/profile/edit/about" class="anchor underline underline-offset-4"
            >{m.form_timezone_change()}</a
          >
        </p>
        {#if calendarNote}<p class="mt-2 text-sm text-surface-700-300">
            {m.form_edit_calendar_note()}
          </p>{/if}
      </div>
    </div>
    {#if $draft.kind === 'campaign'}
      <div class="grid gap-6 sm:grid-cols-2">
        <div class="min-w-0">
          <SegmentedChoice
            id="repeat"
            name="repeat"
            legend={m.form_repeat()}
            options={[
              { value: 'weekly', label: m.form_repeat_weekly() },
              { value: 'biweekly', label: m.form_repeat_biweekly() },
            ]}
            value={$draft.repeat === 'biweekly' ? 'biweekly' : 'weekly'}
            invalid={!!invalid('repeat')}
            describedby={err('repeat') ? 'repeat-error' : undefined}
            onchange={(picked) => ($draft.repeat = picked)}
          />
          <FieldError id="repeat" message={err('repeat')} />
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
          <FieldError id="until" message={err('until')} />
        </div>
      </div>
    {:else if $draft.kind === 'adventure'}
      <FormField
        id="plannedSessions"
        label={m.form_planned_sessions()}
        hint={m.form_planned_sessions_hint()}
        error={err('plannedSessions')}
      >
        {#snippet children(aria)}
          <TextInput
            id="plannedSessions"
            name="plannedSessions"
            inputmode="numeric"
            autocomplete="off"
            maxlength={2}
            required
            bind:value={$draft.plannedSessions}
            class="input h-11 max-w-32 rounded-lg border-control border-ink-muted bg-panel px-3"
            {...aria}
          />
        {/snippet}
      </FormField>
    {/if}
  </FormSection>

  <FormSection id="seats-entry" step={3} title="Vagas e entrada">
    <RadioCards
      name="modality"
      legend={m.form_modality()}
      options={[
        { value: 'online', label: m.table_modality_online(), icon: modalityIcon('online') },
        {
          value: 'in_person',
          label: m.table_modality_in_person(),
          icon: modalityIcon('in_person'),
        },
      ]}
      bind:group={$draft.modality}
    />
    {#if $draft.modality === 'in_person' && places}
      <div>
        <SegmentedChoice
          id="where"
          name="where"
          legend={m.table_form_where()}
          options={[
            { value: 'place', label: m.table_form_where_place() },
            { value: 'other', label: m.table_form_where_other() },
          ]}
          value={where}
          onchange={chooseWhere}
        />
      </div>
    {/if}
    {#if $draft.modality === 'in_person' && places && where === 'place'}
      <div>
        <SearchSelect
          id="placeSlug"
          search
          name="placeSlug"
          label={m.table_form_place()}
          labelClass="label-text block font-semibold"
          class="grid gap-1"
          items={placeItems}
          value={$draft.placeSlug ? [$draft.placeSlug] : []}
          placeholder={m.table_form_place_choose()}
          required
          invalid={!!invalid('placeSlug')}
          onchange={(chosen) => ($draft.placeSlug = chosen[0] ?? '')}
        />
        <FieldError id="placeSlug" message={err('placeSlug')} />
        <p class="mt-2 text-sm text-muted">
          {m.table_form_place_missing()}
          <a class="anchor" href="/pp/new">{m.table_form_place_register()}</a>
        </p>
      </div>
    {:else if $draft.modality === 'in_person'}
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
            class="input h-11 max-w-48 rounded-lg border-control border-ink-muted bg-panel px-3"
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
            class="input h-11 rounded-lg border-control border-ink-muted bg-panel px-3"
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
      <FieldError id="capacity" message={err('capacity')} />
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
          class="input h-11 max-w-32 rounded-lg border-control border-ink-muted bg-panel px-3"
          {...aria}
        />
      {/snippet}
    </FormField>
    <RadioCards
      name="joinMode"
      legend={m.form_join_mode()}
      options={[
        { value: 'auto', label: m.form_join_auto() },
        { value: 'approval', label: m.form_join_approval() },
      ]}
      bind:group={$draft.joinMode}
    />
  </FormSection>

  <FormSection id="image-section" step={4} title="Imagem">
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
  </FormSection>
  {#snippet actions()}
    <MAButton
      type="submit"
      size="custom"
      {controller}
      class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-7 font-semibold"
      >{submitLabel}</MAButton
    >
    {#if draftLabel}
      <MAButton
        type="submit"
        size="custom"
        name="intent"
        value="draft"
        submitting={controller.pending}
        class="btn h-11 gap-2 rounded-lg btn-secondary px-5 font-semibold">{draftLabel}</MAButton
      >
    {/if}
  {/snippet}
  {#snippet preview()}
    <TableCard table={card} />
  {/snippet}
  {#snippet details()}
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
          : $draft.kind === 'adventure'
            ? plannedCount
              ? m.form_schedule_sessions({ count: plannedCount })
              : m.form_schedule_adventure()
            : m.table_recurrence_once()}, {formatHours(
          (Number($draft.durationHours) || 0) * 60,
          getLocale(),
        )}
      </li>
      <li>{$draft.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}</li>
    </ul>
  {/snippet}
</EditorForm>
