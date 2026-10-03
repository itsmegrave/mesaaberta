<script lang="ts">
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  // Mounted for one entry/mode; server loads never overwrite edited values.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import {
    createSchema,
    entrySchema,
    mergeSchema,
    renameSchema,
    type CatalogKind,
  } from '$lib/admin/catalog';
  import FormField from '$lib/components/FormField.svelte';
  import Form from '$lib/components/Form.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { m } from '$lib/paraglide/messages';
  import { slugify } from '$lib/slug';
  import { SUGGESTION_NAME } from '$lib/tables/catalog';
  import { toast } from '$lib/toaster';

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
        : m.admin_dialog_create_title_tag(),
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

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
    if (!details.open) onclose?.();
  }}
  role={red ? 'alertdialog' : 'dialog'}
>
  {#if label}
    <Dialog.Trigger class={triggerClass} aria-label={triggerLabel}>{label}</Dialog.Trigger>
  {/if}
  <!-- Closed positioners must not cover the native approval forms before hydration or without JS. -->
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="w-full max-w-md card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold">{title}</Dialog.Title>
          {#if text}
            <Dialog.Description class="mt-2 text-surface-700-300">{text}</Dialog.Description>
          {/if}
          <Form
            method="POST"
            action={action ?? `?/${mode}`}
            onsubmit={form.submit}
            class="mt-4 grid gap-4"
          >
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
            {#if fieldError && mode === 'merge'}
              <p id="{fieldId}-error" role="alert" class="text-sm font-semibold text-error-700-300">
                {fieldError}
              </p>
            {/if}
            {#if formError}
              <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
            {/if}

            <div class="mt-2 flex flex-wrap justify-end gap-3">
              <Dialog.CloseTrigger
                class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
                >{m.admin_dialog_cancel()}</Dialog.CloseTrigger
              >
              <SubmitButton
                submitting={form.pending}
                delayed={form.delayed}
                timeout={form.timeout}
                class="btn h-12 rounded-lg px-4 font-semibold {red
                  ? 'preset-filled-error-500'
                  : 'preset-filled-primary-500'}">{confirm}</SubmitButton
              >
            </div>
          </Form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  {/if}
</Dialog>
