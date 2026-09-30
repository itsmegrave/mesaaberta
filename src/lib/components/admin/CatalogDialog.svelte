<script lang="ts">
  // The catalog console's dialogs (Skeleton Dialog): merge (a primary button, not red), reject and
  // disable (red), rename and create (a text field checked by the same Zod schema as the server,
  // through Superforms). Each one is a form with its own id, so many can share a page. They need
  // JavaScript; the admin area does not promise to work without it.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { defaults, superForm, type SuperValidated } from 'sveltekit-superforms';
  import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
  import {
    createSchema,
    entrySchema,
    mergeSchema,
    renameSchema,
    type CatalogKind,
  } from '$lib/admin/catalog';
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
  const initial =
    mode === 'create'
      ? { kind, name: '' }
      : mode === 'rename'
        ? { kind, id: entry!.id, name }
        : mode === 'merge'
          ? { kind, id: entry!.id, into }
          : { kind, id: entry!.id };
  type Fields = { kind: string; id?: string; name?: string; into?: string };
  // svelte-ignore state_referenced_locally
  const form = superForm<Fields>(
    defaults(initial as never, zod4(schemas[mode] as never)) as SuperValidated<Fields>,
    {
      id: `${mode}-${entry?.id ?? kind}`,
      validators: zod4Client(schemas[mode] as never),
      resetForm: true,
      // Superforms lets an untouched, empty field through its client check, so the fields that
      // must not go up empty are refused here.
      onSubmit: ({ cancel }) => {
        const missing =
          mode === 'merge'
            ? !data.into
            : mode !== 'reject' && mode !== 'disable' && !data.name?.trim();
        if (!missing) return;
        cancel();
        errors.update((current) =>
          mode === 'merge' ? { ...current, into: ['pick'] } : { ...current, name: ['too_small'] },
        );
      },
      // Not `onUpdated`: the entry may leave the list, and the dialog goes with it.
      onResult: ({ result }) => {
        if (result.type !== 'success') return;
        open = false;
        toast.success(success[mode]);
        onclose?.();
      },
    },
  );
  const { form: values, errors, enhance, submitting, delayed, timeout } = form;
  const data = $derived($values as Record<string, string>);

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
  const fieldError = $derived(say($errors.name?.[0] ?? $errors.into?.[0]));
  const formError = $derived(say($errors._errors?.[0] ?? $errors.id?.[0]));

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
        <form method="POST" action={action ?? `?/${mode}`} use:enhance class="mt-4 grid gap-4">
          <input type="hidden" name="kind" value={data.kind} />
          {#if mode !== 'create'}<input type="hidden" name="id" value={data.id} />{/if}

          {#if mode === 'rename' || mode === 'create'}
            <div class="grid gap-1">
              {#if mode === 'rename'}
                <label for={fieldId} class="label-text font-semibold"
                  >{m.admin_dialog_rename_label()}</label
                >
              {:else}
                <label for={fieldId} class="label-text font-semibold"
                  >{m.admin_catalog_name()}</label
                >
              {/if}
              <input
                id={fieldId}
                name="name"
                type="text"
                autocomplete="off"
                maxlength={SUGGESTION_NAME.max}
                bind:value={$values.name}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby="{fieldId}-hint{fieldError ? ` ${fieldId}-error` : ''}"
                class="input h-12 w-full rounded-lg border-surface-200-800 px-3"
              />
              <p id="{fieldId}-hint" class="text-sm text-surface-700-300">
                {m.admin_dialog_rename_hint({ min: SUGGESTION_NAME.min, max: SUGGESTION_NAME.max })}
                {#if data.name?.trim()}
                  {m.admin_dialog_rename_slug({ slug: slugify(data.name, { fallback: '…' }) })}
                {/if}
              </p>
            </div>
          {:else if mode === 'merge'}
            <div class="grid gap-1">
              <label for={fieldId} class="label-text font-semibold"
                >{m.admin_dialog_merge_into()}</label
              >
              <select
                id={fieldId}
                name="into"
                bind:value={$values.into}
                aria-invalid={fieldError ? 'true' : undefined}
                aria-describedby={fieldError ? `${fieldId}-error` : undefined}
                class="select h-12 w-full rounded-lg border-surface-200-800 px-3"
              >
                <option value="">{m.admin_dialog_merge_pick()}</option>
                {#each candidates.filter((candidate) => candidate.id !== entry?.id) as candidate (candidate.id)}
                  <option value={candidate.id}>{candidate.name}</option>
                {/each}
              </select>
            </div>
          {/if}
          {#if fieldError}
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
              submitting={$submitting}
              delayed={$delayed}
              timeout={$timeout}
              class="btn h-12 rounded-lg px-4 font-semibold {red
                ? 'preset-filled-error-500'
                : 'preset-filled-primary-500'}">{confirm}</SubmitButton
            >
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
