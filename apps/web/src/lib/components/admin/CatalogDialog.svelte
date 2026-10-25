<script lang="ts">
  import SearchSelect from '#lib/components/SearchSelect.svelte';
  // Mounted for one entry/mode; server loads never overwrite edited values.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import {
    createSchema,
    entrySchema,
    mergeSchema,
    renameSchema,
    type CatalogKind,
  } from '@mesaaberta/core/admin/catalog';
  import FormField from '#lib/components/FormField.svelte';
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import Form from '#lib/components/Form.svelte';
  import TextInput from '#lib/components/TextInput.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { slugify } from '@mesaaberta/core/slug';
  import { SUGGESTION_NAME } from '@mesaaberta/core/tables/catalog';
  import { toast } from '#lib/toaster.js';

  type Mode = 'merge' | 'reject' | 'rename' | 'disable' | 'create';
  let {
    mode,
    kind,
    entry,
    candidates = [],
    into = '',
    label,
    triggerLabel,
    triggerClass = '',
    action,
    startOpen = false,
    onclose,
  }: {
    mode: Mode;
    kind: CatalogKind;
    /** The entry the dialog is about; none when creating. */
    entry?: { id: string; name: string };
    /** The entries a merge can fold this one into. */
    candidates?: { id: string; name: string }[];
    /** The entry a merge starts on. */
    into?: string;
    /** The trigger's text. Left out, the dialog has no trigger: a menu opens it (`startOpen`). */
    label?: string;
    /** Names the trigger for screen readers when `label` alone would not say which entry. */
    triggerLabel?: string;
    triggerClass?: string;
    /** Mounted already open, for a menu item that opens it. */
    startOpen?: boolean;
    /** Runs when the dialog is closed (submitted or not). */
    onclose?: () => void;
    /** Where to post; the current page's `?/<mode>` when left out. */
    action?: string;
  } = $props();

  const schemas = {
    merge: mergeSchema,
    reject: entrySchema,
    disable: entrySchema,
    rename: renameSchema,
    create: createSchema,
  };
  const success = {
    merge: m.admin_toast_merge(),
    reject: m.admin_toast_reject(),
    disable: m.admin_toast_disable(),
    rename: m.admin_toast_rename(),
    create: m.admin_toast_create(),
  };
  // The dialog is mounted for one entry and one mode (a page that switches them remounts it), so
  // these are read once.
  // svelte-ignore state_referenced_locally
  const red = mode === 'reject' || mode === 'disable';
  // svelte-ignore state_referenced_locally
  const name = entry?.name ?? '';

  // svelte-ignore state_referenced_locally
  let open = $state(startOpen);
  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { kind, id: entry?.id ?? '', name: mode === 'create' ? '' : name, into },
    schema: schemas[mode],
    domain: 'catalog',
    errorMessage: m.admin_dialog_error,
    onSuccess: () => {
      // Creating is repeatable from the same trigger; start the next entry with an empty name.
      if (mode === 'create') form.reset();
      open = false;
      toast.success(success[mode]);
      onclose?.();
    },
  });
  const data = $derived(form.values);

  const codes: Record<string, () => string> = {
    taken: m.admin_dialog_err_taken,
    too_small: () =>
      m.admin_dialog_err_length({ min: SUGGESTION_NAME.min, max: SUGGESTION_NAME.max }),
    too_big: () =>
      m.admin_dialog_err_length({ min: SUGGESTION_NAME.min, max: SUGGESTION_NAME.max }),
    invalid: () =>
      m.admin_dialog_err_length({ min: SUGGESTION_NAME.min, max: SUGGESTION_NAME.max }),
    same: m.admin_dialog_err_same,
    pick: m.admin_dialog_merge_pick,
    not_approved: m.admin_dialog_err_not_approved,
    not_found: m.admin_dialog_err_gone,
    gone: m.admin_dialog_err_gone,
    not_pending: m.admin_dialog_err_not_pending,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.admin_dialog_error()) : undefined);
  const fieldError = $derived(say(form.errors.name?.[0] ?? form.errors.into?.[0]));
  const formError = $derived(say(form.errors._errors?.[0] ?? form.errors.id?.[0]));

  // svelte-ignore state_referenced_locally
  const title = {
    merge: () => m.admin_dialog_merge_title({ name }),
    reject: () => m.admin_dialog_reject_title({ name }),
    disable: () => m.admin_dialog_disable_title({ name }),
    rename: () => m.admin_dialog_rename_title({ name }),
    create: () =>
      kind === 'platform'
        ? m.admin_dialog_create_title_platform()
        : kind === 'tag'
          ? m.admin_dialog_create_title_tag()
          : m.admin_dialog_create_title_system(),
  }[mode]();
  // svelte-ignore state_referenced_locally
  const text = {
    merge: () => m.admin_dialog_merge_text({ name }),
    reject: () => m.admin_dialog_reject_text({ name }),
    disable: () => m.admin_dialog_disable_text({ name }),
    rename: () => '',
    create: () => '',
  }[mode]();
  // svelte-ignore state_referenced_locally
  const confirm = {
    merge: m.admin_dialog_merge_confirm(),
    reject: m.admin_dialog_reject_confirm(),
    disable: m.admin_dialog_disable_confirm(),
    rename: m.admin_dialog_rename_confirm(),
    create: m.admin_dialog_create_confirm(),
  }[mode];
  // svelte-ignore state_referenced_locally
  const fieldId = `${mode}-${entry?.id ?? kind}-field`;
</script>

<!-- Closed positioners must not cover the native approval forms before hydration or without JS. -->
<DialogShell
  bind:open
  onOpenChange={(next) => {
    if (!next) onclose?.();
  }}
  role={red ? 'alertdialog' : 'dialog'}
  trigger={label ? triggerContent : undefined}
  {triggerClass}
  {triggerLabel}
  {title}
  description={text}
>
  <Form method="POST" action={action ?? `?/${mode}`} onsubmit={form.submit} class="mt-4 grid gap-4">
    <input type="hidden" name="kind" value={data.kind} />
    {#if mode !== 'create'}<input type="hidden" name="id" value={data.id} />{/if}

    {#if mode === 'rename' || mode === 'create'}
      <FormField
        id={fieldId}
        label={mode === 'rename' ? m.admin_dialog_rename_label() : m.admin_catalog_name()}
        error={fieldError}
      >
        <TextInput
          id={fieldId}
          name="name"
          type="text"
          autocomplete="off"
          maxlength={SUGGESTION_NAME.max}
          value={data.name}
          oninput={(event) => form.change('name', event.currentTarget.value)}
          aria-invalid={fieldError ? 'true' : undefined}
          aria-describedby="{fieldId}-hint{fieldError ? ` ${fieldId}-error` : ''}"
        />
        <p id="{fieldId}-hint" class="text-sm text-surface-700-300">
          {m.admin_dialog_rename_hint({
            min: SUGGESTION_NAME.min,
            max: SUGGESTION_NAME.max,
          })}
          {#if data.name?.trim()}
            {m.admin_dialog_rename_slug({ slug: slugify(data.name, { fallback: '…' }) })}
          {/if}
        </p>
      </FormField>
    {:else if mode === 'merge'}
      <SearchSelect
        id={fieldId}
        name="into"
        label={m.admin_dialog_merge_into()}
        labelClass="label-text block font-semibold"
        class="grid gap-1"
        inDialog
        invalid={!!fieldError}
        items={candidates
          .filter((candidate) => candidate.id !== entry?.id)
          .map((candidate) => ({ name: candidate.name, slug: candidate.id }))}
        value={data.into ? [data.into] : []}
        placeholder={m.admin_dialog_merge_pick()}
        onchange={(picked) => form.change('into', picked[0] ?? '')}
      />
    {/if}
    {#if mode === 'merge'}<FieldError id={fieldId} message={fieldError} class="" />{/if}
    {#if formError}
      <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
    {/if}

    <DialogActions
      cancel={m.admin_dialog_cancel()}
      tone={red ? 'danger' : 'primary'}
      controller={form}
      {confirm}
    />
  </Form>
</DialogShell>

{#snippet triggerContent()}{label}{/snippet}
