<script lang="ts">
  import { untrack } from 'svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  // The GM's answer to "did the session happen?", once its date has passed, in steps: the question,
  // then who showed up (and, for a campaign or adventure, whether the table goes on), a new date, or
  // what follows a campaign session that did not happen. Each step is also a `?etapa=` link, so the
  // card works without JavaScript; with it, the links only change the step.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { answerSchema, heldSchema, postponeSchema } from '#lib/tables/confirmation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { toast } from '#lib/toaster.js';
  import Icon from '#lib/components/ui/Icon.svelte';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import SessionPicker from '#lib/components/ui/SessionPicker.svelte';

  export type ConfirmationStep = 'pergunta' | 'presenca' | 'adiar' | 'nao';

  // `players` are the confirmed seats. "It happened" asks who showed up, everyone checked, and
  // whoever is left unchecked cannot rate the GM. A player who already rated (a table that goes
  // on, where the GM let them) played it: their box stays checked and locked, and the server keeps
  // them present too. A disabled box is not posted, so a hidden field sends them.
  // `multi`: a campaign or adventure, whose table can go on after this session; an adventure has no
  // repeat rule, so its picker starts empty and the server asks for the date.
  let {
    next,
    players = [],
    multi = false,
    startsAt = null,
    nextSession = null,
    timezone = 'America/Sao_Paulo',
    durationHours = 4,
    step: initialStep = 'pergunta',
  }: {
    next: string;
    players?: { playerId: string; username: string; avatarUrl: string | null; rated?: boolean }[];
    multi?: boolean;
    /** When the session that passed started, shown above the question. */
    startsAt?: Date | string | null;
    /** A weekly campaign's next date (`YYYY-MM-DDTHH:mm`, the table's zone): the picker starts on it. */
    nextSession?: string | null;
    timezone?: string;
    durationHours?: number;
    /** The step to open on, from `?etapa=`. */
    step?: string | null;
  } = $props();

  const steps: ConfirmationStep[] = ['pergunta', 'presenca', 'adiar', 'nao'];
  // svelte-ignore state_referenced_locally
  let step = $state<ConfirmationStep>(
    steps.includes(initialStep as ConfirmationStep) && (initialStep !== 'nao' || multi)
      ? (initialStep as ConfirmationStep)
      : 'pergunta',
  );
  const go = (to: ConfirmationStep) => (event: MouseEvent) => {
    event.preventDefault();
    step = to;
  };
  const stepHref = (to: ConfirmationStep) => (to === 'pergunta' ? next : `${next}?etapa=${to}`);

  const when = $derived(startsAt ? new Date(startsAt) : null);
  const sessionLabel = $derived(
    when
      ? new Intl.DateTimeFormat(getLocale(), {
          timeZone: timezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
          .format(when)
          .replace(' às ', ', ')
      : null,
  );
  const weekday = $derived(
    when
      ? new Intl.DateTimeFormat(getLocale(), { timeZone: timezone, weekday: 'long' }).format(when)
      : null,
  );
  const title = $derived(
    step === 'presenca'
      ? m.manage_attend_title()
      : step === 'adiar'
        ? m.manage_postpone_title()
        : step === 'nao'
          ? m.manage_skip_heading()
          : weekday
            ? m.manage_confirm_ask_title({ weekday })
            : m.manage_confirm_ask_title_plain(),
  );

  // Who the GM unchecked, for the "Ausente" note and the count under the list.
  let absent = $state<string[]>([]);
  const present = $derived(players.length - absent.length);

  // svelte-ignore state_referenced_locally
  let nextAt = $state(nextSession ?? '');

  let more = $state(true);
  const goesOn = $derived(multi && more);

  // svelte-ignore state_referenced_locally
  const initial = { next };
  const happened = actionForm({
    initial,
    schema: answerSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_concluded()),
  });
  // svelte-ignore state_referenced_locally
  const held = actionForm({
    initial: { nextStartsAtLocal: '', next },
    schema: heldSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_session_held()),
  });
  $effect(() => {
    const value = nextAt;
    untrack(() => held.change('nextStartsAtLocal', value));
  });
  const nextError = (code: string | undefined) =>
    code === 'in_the_past'
      ? m.manage_confirm_in_the_past()
      : code === 'required'
        ? m.manage_confirm_next_required()
        : code;
  const heldError = $derived(
    nextError(held.errors.nextStartsAtLocal?.[0]) ?? held.errors._errors?.[0],
  );
  const notHeld = actionForm({
    initial,
    schema: answerSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_not_held()),
  });
  // A campaign or adventure whose session did not happen: skip it (the table opens for the next
  // date) or close the table, which is then not held and cannot be rated.
  let skip = $state(true);
  // svelte-ignore state_referenced_locally
  let skipAt = $state(nextSession ?? '');
  // svelte-ignore state_referenced_locally
  const skipped = actionForm({
    initial: { nextStartsAtLocal: '', next },
    schema: heldSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_session_skipped()),
  });
  $effect(() => {
    const value = skipAt;
    untrack(() => skipped.change('nextStartsAtLocal', value));
  });
  const skippedError = $derived(
    nextError(skipped.errors.nextStartsAtLocal?.[0]) ?? skipped.errors._errors?.[0],
  );

  let postponeAt = $state('');
  // svelte-ignore state_referenced_locally
  const postpone = actionForm({
    initial: { startsAtLocal: '', next },
    schema: postponeSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_postponed()),
  });
  $effect(() => {
    const value = postponeAt;
    untrack(() => postpone.change('startsAtLocal', value));
  });
  const postponeError = $derived(
    postpone.errors.startsAtLocal?.[0] === 'in_the_past'
      ? m.manage_confirm_in_the_past()
      : postpone.errors.startsAtLocal?.[0]
        ? m.manage_postpone_required()
        : postpone.errors._errors?.[0],
  );

  // A row of a list of choices: a 24px control, a gap and the text, with a line under it.
  const rowClass = 'flex items-center gap-3.5 px-1 py-2';
</script>

<section
  aria-labelledby="session-confirmation"
  class="mt-8 rounded-lg border-2 border-primary-500 bg-panel p-5 md:p-7"
>
  {#if sessionLabel}
    <p class="flex items-center gap-2.5 text-sm font-semibold text-muted">
      <Icon name="calendar" size={16} />{sessionLabel}
    </p>
  {/if}
  <h2
    id="session-confirmation"
    class="text-2xl leading-tight font-semibold tracking-tight text-balance {sessionLabel
      ? 'mt-2'
      : ''}"
  >
    {title}
  </h2>

  {#if step === 'pergunta'}
    <p class="mt-2 max-w-prose">
      {multi ? m.manage_confirm_text_multi() : m.manage_confirm_text()}
    </p>
    <div class="mt-5 flex flex-wrap gap-3">
      {#if players.length > 0 || multi}
        <a
          href={stepHref('presenca')}
          onclick={go('presenca')}
          class="{buttonClass('primary')} gap-2.5 font-semibold no-underline"
          ><Icon name="check" size={18} />{m.manage_confirm_yes()}</a
        >
      {:else}
        <MAForm action="?/happened" onsubmit={happened.submit} class="m-0">
          <input type="hidden" name="next" value={next} />
          <MAButton
            type="submit"
            variant="primary"
            controller={happened}
            class="gap-2.5 font-semibold"
            ><Icon name="check" size={18} />{m.manage_confirm_yes()}</MAButton
          >
        </MAForm>
      {/if}
      {#if multi}
        <a
          href={stepHref('nao')}
          onclick={go('nao')}
          class="{buttonClass('secondary')} font-semibold no-underline"
          >{m.manage_confirm_not_held()}</a
        >
      {:else}
        <MAForm action="?/notHeld" onsubmit={notHeld.submit} class="m-0">
          <input type="hidden" name="next" value={next} />
          <MAButton type="submit" variant="secondary" controller={notHeld} class="font-semibold"
            >{m.manage_confirm_not_held()}</MAButton
          >
        </MAForm>
      {/if}
      <a
        href={stepHref('adiar')}
        onclick={go('adiar')}
        class="{buttonClass('secondary')} gap-2.5 font-semibold no-underline"
        ><Icon name="clock" size={18} />{m.manage_confirm_postpone()}</a
      >
    </div>
    {#if happened.errors._errors?.[0] ?? notHeld.errors._errors?.[0]}
      <p role="alert" class="mt-2 text-sm font-semibold text-error-700-300">
        {happened.errors._errors?.[0] ?? notHeld.errors._errors?.[0]}
      </p>
    {/if}
  {:else if step === 'presenca'}
    <MAForm
      action={goesOn ? '?/sessionHeld' : '?/happened'}
      onsubmit={goesOn ? held.submit : happened.submit}
      class="mt-4"
    >
      <input type="hidden" name="next" value={next} />
      {#if players.length > 0}
        <input type="hidden" name="attendance" value="1" />
        <fieldset class="min-w-0" aria-describedby="attendance-hint">
          <legend class="text-lg font-semibold">{m.manage_attendance_title()}</legend>
          <p id="attendance-hint" class="mt-1 text-sm text-muted">
            {m.manage_attendance_hint()}
          </p>
          <ul class="mt-3 flex flex-col">
            {#each players as player (player.playerId)}
              <li class="border-b border-surface-200-800 last:border-b-0">
                <label class="{rowClass} min-h-16">
                  {#if player.rated}
                    <input type="hidden" name="present" value={player.playerId} />
                  {/if}
                  <input
                    type="checkbox"
                    name={player.rated ? undefined : 'present'}
                    value={player.playerId}
                    checked
                    disabled={player.rated}
                    onchange={(event) =>
                      (absent = event.currentTarget.checked
                        ? absent.filter((id) => id !== player.playerId)
                        : [...absent, player.playerId])}
                    class="checkbox size-6"
                  />
                  <MAAvatar src={player.avatarUrl} name={player.username} size={36} />
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate font-semibold">{player.username}</span>
                    {#if player.rated}
                      <span class="text-sm text-muted">{m.manage_attendance_rated()}</span>
                    {:else if absent.includes(player.playerId)}
                      <span class="text-sm text-muted"
                        >{multi
                          ? m.manage_attendance_absent_session()
                          : m.manage_attendance_absent()}</span
                      >
                    {/if}
                  </span>
                </label>
              </li>
            {/each}
          </ul>
          <p aria-live="polite" class="mt-2 text-sm font-semibold text-muted tabular-nums">
            {m.manage_attendance_count({ present, total: players.length })}
          </p>
        </fieldset>
      {/if}
      {#if multi}
        <fieldset
          class="min-w-0 {players.length > 0 ? 'mt-6 border-t border-surface-200-800 pt-5' : ''}"
        >
          <legend class="float-left w-full text-lg font-semibold">
            {m.manage_confirm_more_title()}
          </legend>
          <div class="clear-both pt-1.5">
            <label class="{rowClass} min-h-14 border-b border-surface-200-800">
              <input type="radio" class="radio size-6" bind:group={more} value={true} />
              {@render choice(m.manage_confirm_more_yes(), m.manage_confirm_more_yes_hint())}
            </label>
            {#if more}
              <!-- Under the choice's text: the 24px control plus the 14px gap. -->
              <div class="mt-3 mb-4 ml-9.5">
                <SessionPicker
                  bind:startsAt={nextAt}
                  duration={durationHours}
                  {timezone}
                  withDuration={false}
                  name="nextStartsAtLocal"
                  label={m.manage_confirm_next_label()}
                  hint={nextSession
                    ? m.manage_confirm_next_hint()
                    : m.manage_confirm_next_hint_adventure()}
                  invalid={!!heldError}
                />
              </div>
            {/if}
            <label class="{rowClass} min-h-14">
              <input type="radio" class="radio size-6" bind:group={more} value={false} />
              {@render choice(m.manage_confirm_more_no(), m.manage_confirm_more_no_hint())}
            </label>
          </div>
        </fieldset>
      {/if}
      {#if goesOn ? heldError : happened.errors._errors?.[0]}
        <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
          {goesOn ? heldError : happened.errors._errors?.[0]}
        </p>
      {/if}
      <div class="mt-5 flex flex-wrap gap-3">
        <MAButton
          type="submit"
          variant="primary"
          controller={goesOn ? held : happened}
          class="font-semibold"
          >{goesOn
            ? m.manage_confirm_held()
            : multi
              ? m.manage_confirm_conclude()
              : m.manage_attendance_submit()}</MAButton
        >
        {@render back()}
      </div>
    </MAForm>
  {:else if step === 'adiar'}
    <MAForm action="?/postpone" onsubmit={postpone.submit} class="mt-4">
      <input type="hidden" name="next" value={next} />
      <SessionPicker
        bind:startsAt={postponeAt}
        duration={durationHours}
        {timezone}
        withDuration={false}
        name="startsAtLocal"
        label={m.manage_confirm_postpone_label()}
        invalid={!!postponeError}
      />
      <p class="mt-3 text-sm text-muted">{m.manage_postpone_note()}</p>
      {#if postponeError}
        <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">{postponeError}</p>
      {/if}
      <div class="mt-5 flex flex-wrap gap-3">
        <MAButton type="submit" variant="primary" controller={postpone} class="font-semibold"
          >{m.manage_confirm_postpone()}</MAButton
        >
        {@render back()}
      </div>
    </MAForm>
  {:else}
    <MAForm
      action={skip ? '?/sessionSkipped' : '?/notHeld'}
      onsubmit={skip ? skipped.submit : notHeld.submit}
      class="mt-4"
    >
      <input type="hidden" name="next" value={next} />
      <fieldset class="min-w-0">
        <legend class="float-left w-full text-lg font-semibold">{m.manage_skip_title()}</legend>
        <div class="clear-both pt-1.5">
          <label class="{rowClass} min-h-14 border-b border-surface-200-800">
            <input type="radio" class="radio size-6" bind:group={skip} value={true} />
            {@render choice(m.manage_skip_yes(), m.manage_skip_yes_hint())}
          </label>
          {#if skip}
            <div class="mt-3 mb-4 ml-9.5">
              <SessionPicker
                bind:startsAt={skipAt}
                duration={durationHours}
                {timezone}
                withDuration={false}
                name="nextStartsAtLocal"
                label={m.manage_confirm_next_label()}
                hint={nextSession
                  ? m.manage_confirm_next_hint()
                  : m.manage_confirm_next_hint_adventure()}
                invalid={!!skippedError}
              />
            </div>
          {/if}
          <label class="{rowClass} min-h-14">
            <input type="radio" class="radio size-6" bind:group={skip} value={false} />
            {@render choice(m.manage_skip_close(), m.manage_skip_close_hint())}
          </label>
        </div>
      </fieldset>
      {#if skip ? skippedError : notHeld.errors._errors?.[0]}
        <p role="alert" class="mt-3 text-sm font-semibold text-error-700-300">
          {skip ? skippedError : notHeld.errors._errors?.[0]}
        </p>
      {/if}
      <div class="mt-5 flex flex-wrap gap-3">
        <MAButton
          type="submit"
          variant="primary"
          controller={skip ? skipped : notHeld}
          class="font-semibold"
          >{skip ? m.manage_skip_submit() : m.manage_skip_close_submit()}</MAButton
        >
        {@render back()}
      </div>
    </MAForm>
  {/if}
</section>

{#snippet back()}
  <a
    href={stepHref('pergunta')}
    onclick={go('pergunta')}
    class="{buttonClass('secondary')} font-semibold no-underline">{m.manage_confirm_back()}</a
  >
{/snippet}

{#snippet choice(label: string, hint: string)}
  <span class="flex min-w-0 flex-col">
    <span class="font-semibold">{label}</span>
    <span class="text-sm text-muted">{hint}</span>
  </span>
{/snippet}
