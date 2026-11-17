<script lang="ts">
  // "Sugerir ferramenta" and the admin's "Editar ferramenta": the same form. The name, the site, the
  // kinds and a line about it, then an optional square logo. The card as it will look sits beside it
  // (below it on a phone). A suggestion waits for an admin; an admin's edit takes effect at once.
  import EditorForm from '#lib/components/ui/EditorForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import FormSection from '#lib/components/ui/FormSection.svelte';
  import ImageUpload from '#lib/components/ui/ImageUpload.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';
  import ToolCard from './ui/ToolCard.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult, type FormResult } from '#lib/forms/contract.js';
  import { fieldErrors, problem } from '#lib/forms/field-errors.js';
  import { guardDraft } from '#lib/forms/guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { errorText, formProblem } from '#lib/tables/form-values.js';
  import { toolKindOptions } from '#lib/tools/labels.js';
  import { toast } from '#lib/toaster.js';
  import {
    TOOL_LIMITS,
    toolFormSchema,
    toolKindsOf,
    toolSiteUrl,
  } from '@mesaaberta/core/tools/schema';

  type Values = {
    name: string;
    siteUrl: string;
    kinds: string[];
    description: string;
    logo?: File;
  };

  let {
    initial,
    mode,
    logoUrl = null,
    cancelHref,
  }: {
    initial: FormResult<Values>;
    /** `new` is a member's suggestion; `edit` is an admin's change. */
    mode: 'new' | 'edit';
    /** The logo the tool has now (when editing). */
    logoUrl?: string | null;
    cancelHref: string;
  } = $props();

  const editing = $derived(mode === 'edit');

  // svelte-ignore state_referenced_locally
  const controller = actionForm<Values>({
    ...fromResult(initial),
    schema: toolFormSchema,
    onSuccess: () => toast.success(editing ? m.tool_form_saved() : m.tool_form_sent()),
    errorMessage: m.form_error_unavailable,
  });
  guardDraft(controller);
  const { draft } = controller;

  // --- errors --------------------------------------------------------------------------------------

  const codes: Record<string, () => string> = {
    required: m.form_error_required,
    too_small: m.form_error_required,
    too_long: m.form_error_too_big,
    invalid_url: m.tool_err_invalid_url,
    invalid_format: m.tool_err_invalid_url,
    tool_duplicate: m.tool_err_duplicate,
  };
  const say = (code: string | undefined, field = '') =>
    code ? (codes[code]?.() ?? errorText(code, field)) : undefined;
  const errors = fieldErrors<keyof Values>(controller, say);
  const { err } = errors;
  const kindsError = $derived(
    controller.errors.kinds?.[0] === 'required' ? m.tool_err_kind_required() : err('kinds'),
  );
  const logoError = $derived(
    controller.errors.logo?.[0]
      ? errorText(controller.errors.logo[0], 'image')
      : errors.withMessage('logo', (code) => errorText(code, 'image')),
  );
  const formError = $derived(formProblem(controller.message));

  const problems = $derived(
    errors.summary(
      [
        ['name', m.tool_form_name()],
        ['siteUrl', m.tool_form_site()],
        ['kinds', m.tool_form_kind()],
        ['description', m.tool_form_description()],
      ],
      problem('logo', m.tool_form_logo(), logoError),
    ),
  );

  // --- the preview ---------------------------------------------------------------------------------

  // The picked file is shown as it will look; until one is picked, the logo the tool has now.
  let picked = $state<string | null>(null);
  function pick(files: File[]) {
    if (picked) URL.revokeObjectURL(picked);
    picked = files[0] ? URL.createObjectURL(files[0]) : null;
    controller.change('logo', files[0]);
    controller.validateField('logo');
  }

  const card = $derived({
    name: $draft.name || m.tool_form_name(),
    kinds: toolKindsOf($draft.kinds),
    siteUrl: toolSiteUrl($draft.siteUrl) ?? '',
    description: $draft.description,
    logoUrl: picked ?? logoUrl,
    platformSlug: null,
    openTables: 0,
    pending: !editing,
  });

  const input = 'input h-11 rounded-lg border-control border-ink-muted bg-panel px-3';
</script>

<!-- No `required`, `maxlength` checks by the browser or `type=url`: the browser would check them
     first, in its own words, and show validation in the same translated messages as the server. -->
<EditorForm
  action={editing ? '?/save' : undefined}
  {controller}
  {problems}
  banner={formError}
  {cancelHref}
  note={editing ? undefined : m.tool_form_review_note()}
>
  <FormSection id="about-section" title={m.tool_form_about()}>
    <FormField
      id="name"
      label={m.tool_form_name()}
      error={err('name')}
      counter={{ count: $draft.name.length, max: TOOL_LIMITS.name }}
    >
      {#snippet children(aria)}
        <TextInput
          id="name"
          name="name"
          maxlength={TOOL_LIMITS.name}
          bind:value={$draft.name}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
    <FormField
      id="siteUrl"
      label={m.tool_form_site()}
      hint={m.tool_form_site_hint()}
      error={err('siteUrl')}
    >
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
    <CheckboxPills
      name="kinds"
      legend={m.tool_form_kind()}
      hint={m.tool_form_kind_hint()}
      options={toolKindOptions()}
      bind:group={$draft.kinds}
      error={kindsError}
    />
    <FormField
      id="description"
      label={m.tool_form_description()}
      hint={m.tool_form_description_hint()}
      error={err('description')}
      counter={{ count: $draft.description.length, max: TOOL_LIMITS.description }}
    >
      {#snippet children(aria)}
        <TextInput
          id="description"
          name="description"
          maxlength={TOOL_LIMITS.description}
          bind:value={$draft.description}
          class={input}
          {...aria}
        />
      {/snippet}
    </FormField>
  </FormSection>

  <FormSection id="logo-section" title={m.tool_form_logo()}>
    <ImageUpload
      id="logo"
      name="logo"
      kind="avatar"
      label={`${m.tool_form_logo()} (${m.form_optional()})`}
      hint={editing ? m.tool_form_logo_hint_edit() : m.tool_form_logo_hint()}
      error={logoError}
      currentUrl={logoUrl}
      onpick={pick}
    />
  </FormSection>

  {#snippet actions()}
    <MAButton
      type="submit"
      size="custom"
      {controller}
      class="btn h-11 gap-2 rounded-lg preset-filled-primary-500 px-7 font-semibold"
      >{editing ? m.tool_form_submit_edit() : m.tool_form_submit()}</MAButton
    >
  {/snippet}
  {#snippet preview()}
    <ToolCard tool={card} />
  {/snippet}
</EditorForm>
