<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  // The GM's answer to "did the session happen?", once its date has passed: it happened (players are
  // asked to rate), it did not, or a new date (the table opens again until then).
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import Form from '#lib/components/Form.svelte';
  import { answerSchema, heldSchema, postponeSchema } from '#lib/tables/confirmation.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';
  import Avatar from '#lib/components/Avatar.svelte';

  // `players` are the confirmed seats. "It happened" also asks who showed up, everyone checked,
  // and whoever is left unchecked cannot rate the GM.
  // `multi`: a campaign or adventure, whose table can go on after this session; an adventure has no
  // repeat rule, so it needs the next date (`dateRequired`).
  let {
    next,
    players = [],
    multi = false,
    dateRequired = false,
  }: {
    next: string;
    players?: { playerId: string; username: string; avatarUrl: string | null }[];
    multi?: boolean;
    dateRequired?: boolean;
  } = $props();

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
  // svelte-ignore state_referenced_locally
  const postpone = actionForm({
    initial: { startsAtLocal: '', next },
    schema: postponeSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_postponed()),
  });

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
  <p class="mt-2 text-surface-700-300">{m.manage_confirm_text()}</p>

  <div class="mt-5 flex flex-wrap gap-3">
    <Form
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
                  <input
                    type="checkbox"
                    name="present"
                    value={player.playerId}
                    checked
                    class="checkbox"
                  />
                  <Avatar src={player.avatarUrl} name={player.username} size={32} />
                  <span class="min-w-0 truncate">{player.username}</span>
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
            <label class="flex items-center gap-3 font-semibold">
              <input type="radio" class="radio" bind:group={more} value={true} />
              {m.manage_confirm_more_yes()}
            </label>
            <label class="flex items-center gap-3 font-semibold">
              <input type="radio" class="radio" bind:group={more} value={false} />
              {m.manage_confirm_more_no()}
            </label>
          </div>
          {#if more}
            <label class="mt-3 flex flex-col gap-1 text-sm font-semibold">
              {m.manage_confirm_next_label()}
              <input
                type="datetime-local"
                name="nextStartsAtLocal"
                required={dateRequired}
                value={held.values.nextStartsAtLocal}
                oninput={(event) => held.change('nextStartsAtLocal', event.currentTarget.value)}
                aria-invalid={heldError ? 'true' : undefined}
                class="input h-12 rounded-lg border-surface-200-800 px-3"
              />
              {#if !dateRequired}
                <span class="font-normal text-muted">{m.manage_confirm_next_hint()}</span>
              {/if}
            </label>
          {/if}
        </fieldset>
      {/if}
      <Button
        type="submit"
        variant="primary"
        controller={goesOn ? held : happened}
        class="font-semibold"
        >{goesOn ? m.manage_confirm_held() : m.manage_confirm_happened()}</Button
      >
      {#if goesOn ? heldError : happened.errors._errors?.[0]}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
          {goesOn ? heldError : happened.errors._errors?.[0]}
        </p>
      {/if}
    </Form>
    <Form action="?/notHeld" onsubmit={notHeld.submit} class="m-0">
      <input type="hidden" name="next" value={next} />
      <Button type="submit" variant="secondary" controller={notHeld} class="font-semibold"
        >{m.manage_confirm_not_held()}</Button
      >
      {#if notHeld.errors._errors?.[0]}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
          {notHeld.errors._errors[0]}
        </p>
      {/if}
    </Form>
  </div>

  <Form
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
        class="input h-12 rounded-lg border-surface-200-800 px-3"
      />
    </label>
    <Button type="submit" variant="secondary" controller={postpone} class="font-semibold"
      >{m.manage_confirm_postpone()}</Button
    >
    {#if postponeError}
      <p role="alert" class="w-full text-sm font-semibold text-error-700-300">{postponeError}</p>
    {/if}
  </Form>
</section>
