<script lang="ts">
  import type { SuperForm } from 'sveltekit-superforms';
  import FormField from './FormField.svelte';
  import SearchSelect from './SearchSelect.svelte';
  import type { FormMessage } from '$lib/forms/message';
  import { errorText, formProblem, type TableFormValues } from '$lib/tables/form-values';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { localizedHref } from '$lib/i18n/locales';
  import { formatDuration, zonedToDate } from '$lib/tables/format';
  import TableCard from './TableCard.svelte';

  type Props = {
    superform: SuperForm<TableFormValues, FormMessage>;
    systems: { name: string; slug: string }[];
    /** The approved platforms and tags a table can pick. */
    catalog: {
      platforms: { name: string; slug: string }[];
      tags: { name: string; slug: string }[];
    };
    submitLabel: string;
    imageUrl?: string | null;
    action?: string;
    /** Where "Cancelar" goes: the list for a new table, the table itself when editing. */
    cancelHref?: string;
    /** Shown as the GM on the preview card. */
    gmName?: string;
  };

  let {
    superform,
    systems,
    catalog,
    submitLabel,
    imageUrl = null,
    action,
    cancelHref = '/tables',
    gmName = 'jogador',
  }: Props = $props();
  const { form, errors, message, enhance, delayed } = superform;
  // "GMT-3": the zone's offset at the first session, or now until one is typed.
  const zoneOffset = $derived(
    new Intl.DateTimeFormat('pt-BR', { timeZone: $form.timezone, timeZoneName: 'shortOffset' })
      .formatToParts(zonedToDate($form.startsAtLocal, $form.timezone) ?? new Date())
      .find((part) => part.type === 'timeZoneName')?.value ?? '',
  );
  const previewSystem = $derived(
    systems.find((system) => system.slug === $form.systemSlug)?.name ?? m.form_system(),
  );
  const nameOf = (list: { name: string; slug: string }[], slug: string) =>
    list.find((item) => item.slug === slug)?.name ?? slug;
  const chip =
    'relative inline-flex h-10 cursor-pointer items-center rounded-lg border-2 border-surface-200-800 px-3.5 text-sm font-semibold has-[:checked]:border-primary-500 has-[:checked]:bg-primary-500/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary-500';

  // The card the list will show, from what is typed so far.
  const preview = $derived({
    slug: 'preview',
    title: $form.title || m.form_preview_title(),
    kind: $form.kind,
    system: { name: previewSystem },
    gmName,
    capacity: Number($form.capacity) || 1,
    seatsLeft: Number($form.capacity) || 1,
    timezone: $form.timezone,
    nextAt: zonedToDate($form.startsAtLocal, $form.timezone),
    imageUrl,
    modality: $form.modality,
    locationArea: $form.locationArea || null,
    platforms: $form.platforms.map((slug) => nameOf(catalog.platforms, slug)),
    tags: $form.tags.map((slug) => nameOf(catalog.tags, slug)),
  });
  // A plain field's errors are a list; a list field's (platforms, tags) are under `_errors`.
  const firstError = (value: unknown): string | undefined =>
    Array.isArray(value)
      ? (value[0] as string | undefined)
      : ((value as { _errors?: string[] } | undefined)?._errors?.[0] ?? undefined);
  const err = (field: keyof TableFormValues) => {
    const code = firstError($errors[field]);
    return code ? errorText(code, field) : undefined;
  };
  const imageError = $derived(
    $message?.field === 'image' ? errorText($message.code, 'image') : undefined,
  );
  const invalid = (field: keyof TableFormValues) =>
    firstError($errors[field]) ? 'true' : undefined;
  const problem = $derived(formProblem($message));
  const hasErrors = $derived(
    Object.values($errors).some((list) => Array.isArray(list) && list.length > 0) || !!imageError,
  );
</script>

<form
  method="POST"
  {action}
  enctype="multipart/form-data"
  use:enhance
  class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12"
>
  <div class="grid gap-8">
    {#if hasErrors}<p role="alert" class="font-semibold text-error-700-300">
        {m.form_summary()}
      </p>{/if}
    {#if problem}<p role="alert" class="font-semibold text-error-700-300">{problem}</p>{/if}

    <section
      aria-labelledby="about-table"
      class="rounded-lg border border-surface-200-800 bg-panel p-6 sm:p-8"
    >
      <div class="mb-6 flex items-center gap-3">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full preset-filled-primary-500 text-base font-bold"
          aria-hidden="true">1</span
        >
        <h2 id="about-table" class="text-2xl font-semibold tracking-[-0.02em]">Sobre a mesa</h2>
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
            value={$form.systemSlug ? [$form.systemSlug] : []}
            placeholder={m.form_system_choose()}
            required
            invalid={!!invalid('systemSlug')}
            onchange={(picked) => ($form.systemSlug = picked[0] ?? '')}
          />
          {#if err('systemSlug')}<p
              id="systemSlug-error"
              role="alert"
              class="mt-1 text-sm font-semibold text-error-700-300"
            >
              {err('systemSlug')}
            </p>{/if}
        </div>
        <FormField id="title" label={m.form_title()} error={err('title')}>
          <input
            id="title"
            name="title"
            required
            minlength="3"
            maxlength="80"
            bind:value={$form.title}
            class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
            aria-invalid={invalid('title')}
          />
        </FormField>
        {#each [{ field: 'platforms', legend: m.form_platforms(), hint: m.form_platforms_hint(), items: catalog.platforms }, { field: 'tags', legend: m.form_tags(), hint: m.form_tags_hint(), items: catalog.tags }] as group (group.field)}
          <fieldset aria-describedby="{group.field}-hint">
            <legend class="font-semibold">{group.legend}</legend>
            <p id="{group.field}-hint" class="text-sm text-surface-700-300">{group.hint}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              {#each group.items as item (item.slug)}
                <label class={chip}>
                  <input
                    type="checkbox"
                    name={group.field}
                    value={item.slug}
                    bind:group={$form[group.field as 'platforms' | 'tags']}
                    class="sr-only"
                  />{item.name}
                </label>
              {/each}
            </div>
            {#if err(group.field as 'platforms' | 'tags')}<p
                role="alert"
                class="mt-1 text-sm font-semibold text-error-700-300"
              >
                {err(group.field as 'platforms' | 'tags')}
              </p>{/if}
          </fieldset>
        {/each}
        <FormField id="description" label={m.form_description()} error={err('description')}>
          <textarea
            id="description"
            name="description"
            rows="5"
            maxlength="4000"
            bind:value={$form.description}
            class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
            aria-invalid={invalid('description')}></textarea>
        </FormField>
        <FormField
          id="extraInfo"
          label={m.form_extra_info()}
          hint={m.form_extra_info_hint()}
          error={err('extraInfo')}
        >
          <textarea
            id="extraInfo"
            name="extraInfo"
            rows="3"
            maxlength="2000"
            bind:value={$form.extraInfo}
            class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
            aria-invalid={invalid('extraInfo')}></textarea>
        </FormField>
        <FormField
          id="welcomeMessage"
          label={m.form_welcome_message()}
          hint={m.form_welcome_message_hint({ token: '{nome da mesa}' })}
          error={err('welcomeMessage')}
        >
          <textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows="4"
            maxlength="1000"
            bind:value={$form.welcomeMessage}
            class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
            aria-invalid={invalid('welcomeMessage')}></textarea>
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
        <h2 id="when" class="text-2xl font-semibold tracking-[-0.02em]">Quando</h2>
      </div>
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_kind()}</legend>
        {#each [['one_shot', m.form_kind_one_shot()], ['campaign', m.form_kind_campaign()]] as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/8"
            ><input type="radio" name="kind" {value} bind:group={$form.kind} />{label}</label
          >{/each}
        {#if $errors.kind}<p role="alert" class="text-sm font-semibold text-error-700-300">
            {err('kind')}
          </p>{/if}
      </fieldset>
      <div class="grid gap-6 sm:grid-cols-2">
        <FormField id="startsAtLocal" label={m.form_starts_at()} error={err('startsAtLocal')}
          ><input
            id="startsAtLocal"
            name="startsAtLocal"
            type="datetime-local"
            required
            bind:value={$form.startsAtLocal}
            class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
            aria-invalid={invalid('startsAtLocal')}
          /></FormField
        >
        <FormField id="durationMinutes" label={m.form_duration()} error={err('durationMinutes')}
          ><input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            required
            min="15"
            max="1440"
            step="5"
            bind:value={$form.durationMinutes}
            class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
            aria-invalid={invalid('durationMinutes')}
          /></FormField
        >
        <div class="min-w-0 sm:col-span-2">
          <input type="hidden" name="timezone" value={$form.timezone} />
          <p class="text-sm text-surface-700-300">
            {m.form_timezone_note({
              zone: $form.timezone.replaceAll('_', ' '),
              offset: zoneOffset,
            })}
            <a href={localizedHref('/account/profile', getLocale())} class="anchor"
              >{m.form_timezone_change()}</a
            >
          </p>
        </div>
      </div>
      {#if $form.kind === 'campaign'}
        <div class="grid gap-6 sm:grid-cols-2">
          <FormField id="repeat" label={m.form_repeat()} error={err('repeat')}
            ><select
              id="repeat"
              name="repeat"
              bind:value={$form.repeat}
              class="select h-12 rounded-lg border-surface-200-800 bg-panel px-3"
              aria-invalid={invalid('repeat')}
              ><option value="weekly">{m.form_repeat_weekly()}</option><option value="biweekly"
                >{m.form_repeat_biweekly()}</option
              ></select
            ></FormField
          >
          <FormField
            id="until"
            label={m.form_until()}
            hint={m.form_until_hint()}
            error={err('until')}
            ><input
              id="until"
              name="until"
              type="date"
              bind:value={$form.until}
              class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
              aria-invalid={invalid('until')}
            /></FormField
          >
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
        <h2 id="seats-entry" class="text-2xl font-semibold tracking-[-0.02em]">Vagas e entrada</h2>
      </div>
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_modality()}</legend
        >{#each [['online', m.table_modality_online()], ['in_person', m.table_modality_in_person()]] as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/8"
            ><input
              type="radio"
              name="modality"
              {value}
              bind:group={$form.modality}
            />{label}</label
          >{/each}
      </fieldset>
      {#if $form.modality === 'in_person'}
        <FormField
          id="postalCode"
          label={m.form_postal_code()}
          hint={m.form_postal_code_hint()}
          error={err('postalCode')}
          ><input
            id="postalCode"
            name="postalCode"
            inputmode="numeric"
            autocomplete="postal-code"
            maxlength="10"
            placeholder="00000-000"
            bind:value={$form.postalCode}
            class="input h-12 max-w-48 rounded-lg border-surface-200-800 bg-panel px-3"
            aria-invalid={invalid('postalCode')}
          /></FormField
        >
        <FormField
          id="locationArea"
          label={m.form_location_area()}
          hint={$form.postalCode ? m.form_location_area_hint_cep() : m.form_location_area_hint()}
          error={err('locationArea')}
          ><input
            id="locationArea"
            name="locationArea"
            maxlength="120"
            autocomplete="off"
            bind:value={$form.locationArea}
            class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
            aria-invalid={invalid('locationArea')}
          /></FormField
        >
      {/if}
      <FormField
        id="joinDetails"
        label={$form.modality === 'in_person'
          ? m.form_join_details_place()
          : m.form_join_details_link()}
        hint={m.form_join_details_hint()}
        error={err('joinDetails')}
        ><textarea
          id="joinDetails"
          name="joinDetails"
          rows="3"
          maxlength="1000"
          bind:value={$form.joinDetails}
          class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
          aria-invalid={invalid('joinDetails')}></textarea></FormField
      >
      <FormField id="capacity" label={m.form_capacity()} error={err('capacity')}
        ><input
          id="capacity"
          name="capacity"
          type="number"
          required
          min="1"
          max="30"
          bind:value={$form.capacity}
          class="input h-12 rounded-lg border-surface-200-800 bg-panel px-3"
          aria-invalid={invalid('capacity')}
        /></FormField
      >
      <fieldset class="grid gap-3 sm:grid-cols-2">
        <legend class="mb-2 font-semibold sm:col-span-2">{m.form_join_mode()}</legend
        >{#each [['auto', m.form_join_auto()], ['approval', m.form_join_approval()]] as [value, label] (value)}<label
            class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-surface-200-800 p-4 font-semibold has-checked:border-primary-500 has-checked:bg-primary-500/8"
            ><input
              type="radio"
              name="joinMode"
              {value}
              bind:group={$form.joinMode}
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
        <h2 id="image-section" class="text-2xl font-semibold tracking-[-0.02em]">Imagem</h2>
      </div>
      <div class="rounded-lg border-2 border-dashed border-surface-400-600 bg-surface-950-50/4 p-5">
        <FormField
          id="image"
          label={m.form_image()}
          hint={imageUrl ? m.form_image_current() : m.form_image_hint()}
          error={imageError}
        >
          {#if imageUrl}<img
              src={imageUrl}
              alt=""
              class="mb-3 aspect-736/300 w-full max-w-sm rounded-lg object-cover"
            />{/if}
          <input
            id="image"
            name="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="block w-full text-sm file:mr-3 file:h-11 file:rounded-lg file:border-2 file:border-surface-950-50 file:bg-transparent file:px-4 file:font-semibold"
            aria-invalid={imageError ? 'true' : undefined}
          />
        </FormField>
      </div>
    </section>
    <div class="flex flex-wrap items-center gap-5">
      <button
        type="submit"
        class="btn h-13 rounded-lg preset-filled-primary-500 px-7 font-semibold"
        aria-busy={$delayed}>{submitLabel}</button
      >
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
      <a href={cancelHref} class="link-underline font-semibold text-link">{m.form_cancel()}</a>
    </div>
  </div>
  <aside aria-labelledby="preview-title" class="lg:sticky lg:top-6 lg:self-start">
    <p id="preview-title" class="text-sm font-bold tracking-[0.06em] text-muted uppercase">
      {m.form_preview()}
    </p>
    <!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
    <div class="mt-3" inert>
      <TableCard table={preview} />
    </div>
    <ul class="mt-4 grid gap-2 rounded-lg border border-surface-200-800 bg-panel p-5 text-sm">
      <li>
        {$form.modality === 'in_person'
          ? `${m.table_modality_in_person()}${$form.locationArea ? ` · ${$form.locationArea}` : ''}`
          : m.table_modality_online()}
      </li>
      <li>
        {$form.kind === 'campaign'
          ? $form.repeat === 'biweekly'
            ? m.form_repeat_biweekly()
            : m.form_repeat_weekly()
          : m.table_recurrence_once()}, {formatDuration(Number($form.durationMinutes) || 0)}
      </li>
      <li>{$form.joinMode === 'approval' ? m.table_join_approval() : m.table_join_auto()}</li>
    </ul>
  </aside>
</form>
