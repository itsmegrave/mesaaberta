<script lang="ts">
  import TextArea from '$lib/components/TextArea.svelte';
  import UserText from '$lib/components/UserText.svelte';
  // One moderation decision behind a confirmation: accept, dismiss, close a table, ban or revoke a
  // ban. Mounted per action; the server authorizes it again.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { ZodType } from 'zod';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { BAN_DURATIONS, RESOLUTION_NOTE_MAX, type BanDuration } from '$lib/moderation/reports';
  import Form from '$lib/components/Form.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    action,
    schema,
    fields,
    title,
    username,
    text,
    confirm,
    label,
    success,
    danger = false,
    write,
    durations = false,
    triggerClass = '',
  }: {
    /** The form action, `?/<name>`. */
    action: string;
    schema: ZodType;
    /** The hidden fields the action takes (the report, the profile). */
    fields: Record<string, string>;
    title: string;
    username?: string | null;
    text: string;
    confirm: string;
    /** The trigger's text. */
    label: string;
    success: string;
    /** Red: the decision takes something away. */
    danger?: boolean;
    /** A text the admin writes: a note on the report, the GM's justification, the ban's reason. */
    write?: { name: 'note' | 'reason'; label: string; hint: string; required?: boolean };
    /** Asks how long a ban lasts. */
    durations?: boolean;
    triggerClass?: string;
  } = $props();

  let open = $state(false);
  // svelte-ignore state_referenced_locally
  const form = actionForm<Record<string, string>>({
    initial: {
      ...fields,
      ...(write ? { [write.name]: '' } : {}),
      ...(durations ? { duration: '' } : {}),
    },
    schema,
    errorMessage: m.admin_dialog_error,
    onSuccess: () => {
      open = false;
      form.reset();
      toast.success(success);
    },
  });
  const data = $derived(form.values as Record<string, string>);

  const durationLabel = (duration: BanDuration) =>
    duration === 'permanent'
      ? m.moderation_ban_permanent()
      : m.moderation_ban_days({ days: Number(duration) });
  const codes: Record<string, () => string> = {
    too_big: () => m.moderation_note_too_big({ max: RESOLUTION_NOTE_MAX }),
    too_small: m.moderation_text_required,
    invalid_value: m.moderation_duration_required,
    not_open: m.moderation_err_changed,
    closed: m.moderation_err_changed,
    not_found: m.moderation_err_changed,
    banned: m.moderation_err_banned,
    forbidden: m.moderation_err_forbidden,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.admin_dialog_error()) : undefined);
  // svelte-ignore state_referenced_locally
  const own = [write?.name, 'duration'];
  const textError = $derived(say(write ? form.errors[write.name]?.[0] : undefined));
  const durationError = $derived(say(form.errors.duration?.[0]));
  const formError = $derived(
    say(
      form.errors._errors?.[0] ??
        Object.entries(form.errors).find(([field]) => !own.includes(field))?.[1]?.[0],
    ),
  );
  // svelte-ignore state_referenced_locally
  const id = action.slice(2);
</script>

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
  }}
  role={danger ? 'alertdialog' : 'dialog'}
>
  <Dialog.Trigger class={triggerClass}>{label}</Dialog.Trigger>
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="max-h-full w-full max-w-md overflow-y-auto card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold"
            ><UserText text={title} {username} /></Dialog.Title
          >
          <Dialog.Description class="mt-2 text-surface-700-300">{text}</Dialog.Description>
          <Form method="POST" {action} onsubmit={form.submit} class="mt-4 grid gap-4">
            {#each Object.keys(fields) as name (name)}
              <input type="hidden" {name} value={data[name]} />
            {/each}
            {#if durations}
              <fieldset
                class="grid gap-2"
                aria-describedby={durationError ? `${id}-duration-error` : undefined}
              >
                <legend class="label-text font-semibold">{m.moderation_ban_duration()}</legend>
                <div class="grid grid-cols-2 gap-2">
                  {#each BAN_DURATIONS as duration (duration)}
                    <label
                      class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-surface-200-800 px-3 has-checked:border-primary-500 has-checked:preset-tonal-primary"
                    >
                      <input
                        type="radio"
                        class="radio"
                        name="duration"
                        value={duration}
                        checked={data.duration === duration}
                        onchange={() => form.change('duration', duration)}
                      />
                      {durationLabel(duration)}
                    </label>
                  {/each}
                </div>
                {#if durationError}
                  <p
                    id="{id}-duration-error"
                    role="alert"
                    class="text-sm font-semibold text-error-700-300"
                  >
                    {durationError}
                  </p>
                {/if}
              </fieldset>
            {/if}
            {#if write}
              <FormField
                id="{id}-{write.name}"
                label={write.label}
                hint={write.hint}
                error={textError}
              >
                <TextArea
                  id="{id}-{write.name}"
                  name={write.name}
                  rows={3}
                  maxlength={RESOLUTION_NOTE_MAX}
                  required={write.required}
                  class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
                  value={data[write.name]}
                  oninput={(event) => form.change(write.name, event.currentTarget.value)}
                  aria-invalid={textError ? 'true' : undefined}
                  aria-describedby="{id}-{write.name}-hint{textError
                    ? ` ${id}-${write.name}-error`
                    : ''}"
                ></TextArea>
              </FormField>
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
                class="btn h-12 rounded-lg px-4 font-semibold {danger
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
