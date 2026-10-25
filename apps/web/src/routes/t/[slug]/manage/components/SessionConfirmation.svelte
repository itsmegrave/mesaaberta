<script lang="ts">
  import { untrack } from 'svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  // The GM's answer to "did the session happen?", once its date has passed: it happened (players are
  // asked to rate), it did not, or a new date (the table opens again until then).
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { answerSchema, heldSchema, postponeSchema } from '#lib/tables/confirmation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import MAAvatar from '#lib/components/ui/MAAvatar.svelte';
  import SessionPicker from '#lib/components/ui/SessionPicker.svelte';

  // `players` are the confirmed seats. "It happened" also asks who showed up, everyone checked,
  // and whoever is left unchecked cannot rate the GM. A player who already rated (a table that goes
  // on, where the GM let them) played it: their box stays checked and locked, and the server keeps
  // them present too. A disabled box is not posted, so a hidden field sends them.
  // `multi`: a campaign or adventure, whose table can go on after this session; an adventure has no
  // repeat rule, so its picker starts empty and the server asks for the date.
  let {
    next,
    players = [],
    multi = false,
    nextSession = null,
    timezone = 'America/Sao_Paulo',
    durationHours = 4,
  }: {
    next: string;
    players?: { playerId: string; username: string; avatarUrl: string | null; rated?: boolean }[];
    multi?: boolean;
    /** A weekly campaign's next date (`YYYY-MM-DDTHH:mm`, the table's zone): the picker starts on it. */
    nextSession?: string | null;
    timezone?: string;
    durationHours?: number;
  } = $props();

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
  const heldError = $derived(
    held.errors.nextStartsAtLocal?.[0] === 'in_the_past'
      ? m.manage_confirm_in_the_past()
      : held.errors.nextStartsAtLocal?.[0] === 'required'
        ? m.manage_confirm_next_required()
        : (held.errors.nextStartsAtLocal?.[0] ?? held.errors._errors?.[0]),
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
    skipped.errors.nextStartsAtLocal?.[0] === 'in_the_past'
      ? m.manage_confirm_in_the_past()
      : skipped.errors.nextStartsAtLocal?.[0] === 'required'
        ? m.manage_confirm_next_required()
        : (skipped.errors.nextStartsAtLocal?.[0] ?? skipped.errors._errors?.[0]),
  );

  // svelte-ignore state_referenced_locally
  const postpone = actionForm({
    initial: { startsAtLocal: '', next },
    schema: postponeSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_postponed()),
  });

  const choiceClass =
    'flex min-h-14 items-center gap-3 rounded-lg border-2 border-surface-200-800 px-3 py-2 has-checked:border-primary-500 has-checked:bg-primary-500/10 has-focus-visible:outline-4 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500';

  const postponeError = $derived(
    postpone.errors.startsAtLocal?.[0] === 'in_the_past'
      ? m.manage_confirm_in_the_past()
      : (postpone.errors.startsAtLocal?.[0] ?? postpone.errors._errors?.[0]),
  );
</script>

<section
  aria-labelledby="session-confirmation"
  class="mt-8 rounded-lg border-2 border-primary-500 bg-panel p-5 md:p-6"
>
  <h2 id="session-confirmation" class="text-xl font-semibold">{m.manage_confirm_title()}</h2>
  <p class="mt-2 text-surface-700-300">
    {multi ? m.manage_confirm_text_multi() : m.manage_confirm_text()}
  </p>

  <div class="mt-5 flex flex-wrap gap-3">
    <MAForm
      action={goesOn ? '?/sessionHeld' : '?/happened'}
      onsubmit={goesOn ? held.submit : happened.submit}
      class={players.length > 0 ? 'm-0 w-full' : 'm-0'}
    >
      <input type="hidden" name="next" value={next} />
      {#if players.length > 0}
        <input type="hidden" name="attendance" value="1" />
        <fieldset class="mb-4 min-w-0">
          <legend class="font-semibold">{m.manage_attendance_title()}</legend>
          <p class="mt-1 text-sm text-muted">{m.manage_attendance_hint()}</p>
          <ul class="mt-3 flex flex-col gap-2">
            {#each players as player (player.playerId)}
              <li>
                <label class="flex items-center gap-3 font-semibold">
                  {#if player.rated}
                    <input type="hidden" name="present" value={player.playerId} />
                  {/if}
                  <input
                    type="checkbox"
                    name={player.rated ? undefined : 'present'}
                    value={player.playerId}
                    checked
                    disabled={player.rated}
                    class="checkbox"
                  />
                  <MAAvatar src={player.avatarUrl} name={player.username} size={32} />
                  <span class="flex min-w-0 flex-col">
                    <span class="truncate">{player.username}</span>
                    {#if player.rated}
                      <span class="text-sm font-normal text-muted"
                        >{m.manage_attendance_rated()}</span
                      >
                    {/if}
                  </span>
                </label>
              </li>
            {/each}
          </ul>
        </fieldset>
      {/if}
      {#if multi}
        <fieldset class="mb-4 min-w-0">
          <legend class="font-semibold">{m.manage_confirm_more_title()}</legend>
          <div class="mt-2 flex flex-col gap-2">
            {#each [{ value: true, label: m.manage_confirm_more_yes(), hint: m.manage_confirm_more_yes_hint() }, { value: false, label: m.manage_confirm_more_no(), hint: m.manage_confirm_more_no_hint() }] as option (option.label)}
              <label class={choiceClass}>
                <input type="radio" class="radio" bind:group={more} value={option.value} />
                {@render choice(option.label, option.hint)}
              </label>
            {/each}
          </div>
          {#if more}
            <div class="mt-4">
              <p class="label-text font-semibold">{m.manage_confirm_next_label()}</p>
              {#if nextSession}
                <p class="mt-1 text-sm text-muted">{m.manage_confirm_next_hint()}</p>
              {/if}
              <div class="mt-3">
                <SessionPicker
                  bind:startsAt={nextAt}
                  duration={durationHours}
                  {timezone}
                  withDuration={false}
                  name="nextStartsAtLocal"
                  invalid={!!heldError}
                />
              </div>
            </div>
          {/if}
        </fieldset>
      {/if}
      <MAButton
        type="submit"
        variant="primary"
        controller={goesOn ? held : happened}
        class="font-semibold"
        >{goesOn
          ? m.manage_confirm_held()
          : multi
            ? m.manage_confirm_conclude()
            : m.manage_confirm_happened()}</MAButton
      >
      {#if goesOn ? heldError : happened.errors._errors?.[0]}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
          {goesOn ? heldError : happened.errors._errors?.[0]}
        </p>
      {/if}
    </MAForm>
    {#if !multi}
      <MAForm action="?/notHeld" onsubmit={notHeld.submit} class="m-0">
        <input type="hidden" name="next" value={next} />
        <MAButton type="submit" variant="secondary" controller={notHeld} class="font-semibold"
          >{m.manage_confirm_not_held()}</MAButton
        >
        {#if notHeld.errors._errors?.[0]}
          <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
            {notHeld.errors._errors[0]}
          </p>
        {/if}
      </MAForm>
    {/if}
  </div>

  {#if multi}
    <!-- Skipping takes a date, so it replaces "Adiar" here. -->
    <MAForm
      action={skip ? '?/sessionSkipped' : '?/notHeld'}
      onsubmit={skip ? skipped.submit : notHeld.submit}
      class="mt-6 border-t border-surface-200-800 pt-5"
    >
      <input type="hidden" name="next" value={next} />
      <fieldset class="mb-4 min-w-0">
        <legend class="font-semibold">{m.manage_skip_title()}</legend>
        <div class="mt-2 flex flex-col gap-2">
          {#each [{ value: true, label: m.manage_skip_yes(), hint: m.manage_skip_yes_hint() }, { value: false, label: m.manage_skip_close(), hint: m.manage_skip_close_hint() }] as option (option.label)}
            <label class={choiceClass}>
              <input type="radio" class="radio" bind:group={skip} value={option.value} />
              {@render choice(option.label, option.hint)}
            </label>
          {/each}
        </div>
        {#if skip}
          <div class="mt-4">
            <p class="label-text font-semibold">{m.manage_confirm_next_label()}</p>
            {#if nextSession}
              <p class="mt-1 text-sm text-muted">{m.manage_confirm_next_hint()}</p>
            {/if}
            <div class="mt-3">
              <SessionPicker
                bind:startsAt={skipAt}
                duration={durationHours}
                {timezone}
                withDuration={false}
                name="nextStartsAtLocal"
                invalid={!!skippedError}
              />
            </div>
          </div>
        {/if}
      </fieldset>
      <MAButton
        type="submit"
        variant="secondary"
        controller={skip ? skipped : notHeld}
        class="font-semibold"
        >{skip ? m.manage_skip_submit() : m.manage_skip_close_submit()}</MAButton
      >
      {#if skip ? skippedError : notHeld.errors._errors?.[0]}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
          {skip ? skippedError : notHeld.errors._errors?.[0]}
        </p>
      {/if}
    </MAForm>
  {:else}
    <MAForm
      action="?/postpone"
      onsubmit={postpone.submit}
      class="mt-6 flex flex-wrap items-end gap-3 border-t border-surface-200-800 pt-5"
    >
      <input type="hidden" name="next" value={next} />
      <label class="flex flex-col gap-1 text-sm font-semibold">
        {m.manage_confirm_postpone_label()}
        <input
          type="datetime-local"
          name="startsAtLocal"
          required
          value={postpone.values.startsAtLocal}
          oninput={(event) => postpone.change('startsAtLocal', event.currentTarget.value)}
          aria-invalid={postponeError ? 'true' : undefined}
          class="input h-13 rounded-lg border-control border-ink-muted px-3"
        />
      </label>
      <MAButton type="submit" variant="secondary" controller={postpone} class="font-semibold"
        >{m.manage_confirm_postpone()}</MAButton
      >
      {#if postponeError}
        <p role="alert" class="w-full text-sm font-semibold text-error-700-300">{postponeError}</p>
      {/if}
    </MAForm>
  {/if}
</section>

{#snippet choice(label: string, hint: string)}
  <span class="flex flex-col">
    <span class="font-semibold">{label}</span>
    <span class="text-sm text-muted">{hint}</span>
  </span>
{/snippet}
