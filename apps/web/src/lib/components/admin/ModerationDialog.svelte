<script lang="ts">
  import ReasonSelect from '#lib/components/ui/ReasonSelect.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import UserText from '#lib/components/ui/UserText.svelte';
  // One moderation decision behind a confirmation: accept, dismiss, close a table, ban or revoke a
  // ban. Mounted per action; the server authorizes it again.
  import type { ZodType } from 'zod';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import {
    BAN_DURATIONS,
    RESOLUTION_NOTE_MAX,
    type BanDuration,
    type ReportReason,
    type ReportTarget,
  } from '@mesaaberta/core/moderation/reports';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  let {
    action,
    schema,
    fields,
    title: titleText,
    username,
    text,
    confirm,
    label,
    success,
    danger = false,
    write,
    durations = false,
    reasons,
    reasonTarget = 'crowdfunding',
    choices = BAN_DURATIONS,
    trigger = true,
    open = $bindable(false),
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
    /** Asks for one of these reasons (taking a campaign down), worded for crowdfunding. */
    reasons?: readonly ReportReason[];
    /** What the reasons are worded for: a campaign (the default) or a partner. */
    reasonTarget?: ReportTarget;
    /** The lengths offered: all of them, or one (permanent, for "Banir"), which is not asked. */
    choices?: readonly BanDuration[];
    /** Draws its own button; off when a menu item opens the dialog through `open`. */
    trigger?: boolean;
    open?: boolean;
    triggerClass?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm<Record<string, string>>({
    initial: {
      ...fields,
      ...(write ? { [write.name]: '' } : {}),
      ...(durations ? { duration: choices.length === 1 ? choices[0] : '' } : {}),
      ...(reasons ? { reason: '' } : {}),
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
    already_approved: m.moderation_err_changed,
    not_found: m.moderation_err_changed,
    banned: m.moderation_err_banned,
    forbidden: m.moderation_err_forbidden,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.admin_dialog_error()) : undefined);
  // svelte-ignore state_referenced_locally
  const own = [write?.name, 'duration', ...(reasons ? ['reason'] : [])];
  const textError = $derived(say(write ? form.errors[write.name]?.[0] : undefined));
  const durationError = $derived(say(form.errors.duration?.[0]));
  const reasonError = $derived(
    reasons && form.errors.reason?.[0] ? m.report_err_reason() : undefined,
  );
  const formError = $derived(
    say(
      form.errors._errors?.[0] ??
        Object.entries(form.errors).find(([field]) => !own.includes(field))?.[1]?.[0],
    ),
  );
  // svelte-ignore state_referenced_locally
  const id = action.slice(2);
</script>

<DialogShell
  bind:open
  role={danger ? 'alertdialog' : 'dialog'}
  scroll
  trigger={trigger ? triggerContent : undefined}
  {triggerClass}
  description={text}
>
  {#snippet title()}<UserText text={titleText} {username} />{/snippet}
  <MAForm method="POST" {action} onsubmit={form.submit} class="mt-4 grid gap-4">
    {#each Object.keys(fields) as name (name)}
      <input type="hidden" {name} value={data[name]} />
    {/each}
    {#if durations && choices.length === 1}
      <input type="hidden" name="duration" value={choices[0]} />
    {:else if durations}
      <fieldset
        class="grid gap-2"
        aria-describedby={durationError ? `${id}-duration-error` : undefined}
      >
        <legend class="label-text font-semibold">{m.moderation_ban_duration()}</legend>
        <div class="grid grid-cols-2 gap-2">
          {#each choices as duration (duration)}
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
          <p id="{id}-duration-error" role="alert" class="text-sm font-semibold text-error-700-300">
            {durationError}
          </p>
        {/if}
      </fieldset>
    {/if}
    {#if reasons}
      <ReasonSelect
        id="{id}-reason"
        {reasons}
        target={reasonTarget}
        value={data.reason}
        error={reasonError}
        onchange={(reason) => form.change('reason', reason)}
      />
    {/if}
    {#if write}
      <FormField id="{id}-{write.name}" label={write.label} hint={write.hint} error={textError}>
        <MATextArea
          id="{id}-{write.name}"
          name={write.name}
          rows={3}
          maxlength={RESOLUTION_NOTE_MAX}
          required={write.required}
          class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
          value={data[write.name]}
          oninput={(event) => form.change(write.name, event.currentTarget.value)}
          aria-invalid={textError ? 'true' : undefined}
          aria-describedby="{id}-{write.name}-hint{textError ? ` ${id}-${write.name}-error` : ''}"
        ></MATextArea>
      </FormField>
    {/if}
    {#if formError}
      <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
    {/if}
    <DialogActions
      cancel={m.admin_dialog_cancel()}
      tone={danger ? 'danger' : 'primary'}
      controller={form}
      {confirm}
    />
  </MAForm>
</DialogShell>

{#snippet triggerContent()}{label}{/snippet}
