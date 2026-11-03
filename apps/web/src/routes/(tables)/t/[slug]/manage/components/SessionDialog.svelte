<script lang="ts">
  import { untrack } from 'svelte';
  // Gerenciar mesa → Sessões, one dialog per action: "Agendar sessão" (day, time, length and a
  // note), "Mudar data", "Escrever nota" and "Cancelar sessão" (with a message to the players).
  // Mounted only while it asks; the server checks everything again.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import {
    cancelSessionSchema,
    moveSessionSchema,
    noteSessionSchema,
    scheduleSessionSchema,
  } from '#lib/tables/confirmation.js';
  import { localInput, sessionDay, type SessionItem } from '#lib/tables/sessions.js';
  import { TABLE_LIMITS } from '@mesaaberta/core/tables/schema';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import SessionPicker from '#lib/components/ui/SessionPicker.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { toast } from '#lib/toaster.js';

  export type SessionDialogMode = 'schedule' | 'move' | 'note' | 'cancel';

  let {
    mode,
    session = null,
    next,
    timezone,
    durationHours,
    suggested = '',
    onclose,
  }: {
    mode: SessionDialogMode;
    /** The session acted on; none to schedule a new one. */
    session?: SessionItem | null;
    /** The manage page, to come back to. */
    next: string;
    /** The table's zone: the form's times are wall-clock times there. */
    timezone: string;
    /** The table's length, which a new session starts with. */
    durationHours: number;
    /** Where "Agendar sessão" starts (`YYYY-MM-DDTHH:mm`): a week after the last date. */
    suggested?: string;
    onclose: () => void;
  } = $props();

  const MAX = TABLE_LIMITS.sessionNote;
  const locale = getLocale();

  const schema = {
    schedule: scheduleSessionSchema,
    move: moveSessionSchema,
    note: noteSessionSchema,
    cancel: cancelSessionSchema,
  }[untrack(() => mode)];
  const done = {
    schedule: m.toast_session_scheduled,
    move: m.toast_session_moved,
    note: m.toast_session_noted,
    cancel: m.toast_session_cancelled,
  }[untrack(() => mode)];

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: {
      next,
      sessionId: session?.id ?? '',
      startsAtLocal:
        mode === 'move' && session ? localInput(session.startsAt, timezone) : suggested,
      durationHours: String(durationHours),
      note: mode === 'note' ? (session?.note ?? '') : '',
      message: '',
    },
    schema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess() {
      toast.success(done());
      onclose();
    },
  });
  const data = $derived(form.values);

  let startsAt = $state(form.values.startsAtLocal as string);
  let duration = $state(untrack(() => durationHours));
  $effect(() => {
    const value = startsAt;
    untrack(() => form.change('startsAtLocal', value));
  });
  $effect(() => {
    const value = String(duration);
    untrack(() => form.change('durationHours', value));
  });

  const errorText = (code: string | undefined) => {
    switch (code) {
      case undefined:
        return undefined;
      case 'in_the_past':
        return m.manage_confirm_in_the_past();
      case 'invalid':
        return m.sessions_err_date();
      case 'session_taken':
        return m.sessions_err_taken();
      case 'planned_reached':
        return m.sessions_err_planned();
      case 'schedule_conflict':
        return m.sessions_err_conflict();
      case 'only_session':
        return m.sessions_err_only();
      case 'already_started':
        return m.sessions_err_started();
      case 'too_long':
        return m.sessions_err_note({ max: MAX });
      default:
        return code;
    }
  };
  const dateError = $derived(errorText(form.errors.startsAtLocal?.[0]));
  const noteError = $derived(
    form.errors.note?.[0] || form.errors.message?.[0]
      ? m.sessions_err_note({ max: MAX })
      : undefined,
  );
  const formError = $derived(errorText(form.errors.sessionId?.[0]) ?? form.errors._errors?.[0]);

  const title = $derived(
    mode === 'schedule'
      ? m.sessions_schedule()
      : mode === 'move'
        ? m.sessions_move_title({ number: session!.number })
        : mode === 'note'
          ? m.sessions_note_title({ number: session!.number })
          : m.sessions_cancel_title({ number: session!.number }),
  );
  const when = $derived(session ? sessionDay(session.startsAt, timezone, locale, true) : '');
  const action = $derived(
    {
      schedule: '?/scheduleSession',
      move: '?/moveSession',
      note: '?/noteSession',
      cancel: '?/cancelSession',
    }[mode],
  );
  const textField = $derived(mode === 'cancel' ? 'message' : 'note');
  const text = $derived(String(data[textField] ?? ''));
</script>

<DialogShell
  defaultOpen
  size="lg"
  scroll
  sheet
  role={mode === 'cancel' ? 'alertdialog' : 'dialog'}
  onOpenChange={(open) => !open && onclose()}
  {title}
  description={mode === 'schedule' ? undefined : m.sessions_dialog_now({ when })}
>
  <MAForm {action} onsubmit={form.submit} class="mt-4 grid gap-4">
    <input type="hidden" name="next" value={next} />
    {#if session}
      <input type="hidden" name="sessionId" value={session.id} />
    {/if}

    {#if mode === 'schedule' || mode === 'move'}
      <SessionPicker
        bind:startsAt
        bind:duration
        {timezone}
        withDuration={mode === 'schedule'}
        label={mode === 'move' ? m.sessions_move_day() : m.sessions_day()}
        invalid={!!dateError}
      />
      {#if mode === 'schedule'}
        <p class="text-sm text-muted">{m.sessions_duration_hint()}</p>
      {/if}
      {#if dateError}
        <p role="alert" class="text-sm font-semibold text-error-700-300">{dateError}</p>
      {/if}
    {/if}

    {#if mode !== 'move'}
      <FormField
        id="session-text"
        label={mode === 'cancel' ? m.sessions_cancel_message() : m.sessions_note_label()}
        hint={mode === 'cancel' ? undefined : m.sessions_note_hint({ max: MAX })}
        error={noteError}
        optional
        counter={{ count: text.length, max: MAX, remaining: true }}
      >
        {#snippet children(aria)}
          <MATextArea
            id="session-text"
            name={textField}
            rows={3}
            maxlength={MAX}
            class="textarea rounded-lg border-control border-ink-muted bg-panel p-3"
            value={text}
            oninput={(event) => form.change(textField, event.currentTarget.value)}
            {...aria}
          ></MATextArea>
        {/snippet}
      </FormField>
    {/if}

    <p class="text-sm text-muted">
      {mode === 'note'
        ? m.sessions_note_quiet()
        : mode === 'cancel'
          ? m.sessions_cancel_notice()
          : m.sessions_notice()}
    </p>
    {#if formError}
      <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
    {/if}

    <DialogActions
      cancel={mode === 'schedule' ? m.admin_dialog_cancel() : m.sessions_back()}
      controller={form}
      tone={mode === 'cancel' ? 'danger' : 'primary'}
      confirm={mode === 'schedule'
        ? m.sessions_schedule()
        : mode === 'move'
          ? m.sessions_move()
          : mode === 'note'
            ? m.sessions_note_save()
            : m.sessions_cancel()}
    />
  </MAForm>
</DialogShell>
