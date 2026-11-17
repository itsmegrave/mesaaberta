<script lang="ts">
  // A campanha aberta's session on the table page (`use_session_signup`): how many of its places
  // are taken and, for a player on the roster, "Quero jogar esta", the waiting list when it is
  // full, and leaving either. Everyone else sees the places alone.
  import PostButton from '#lib/components/PostButton.svelte';
  import type { SessionSeats } from '#lib/tables/sessions.js';
  import { sessionSignupSchema } from '#lib/tables/registration.js';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  let {
    sessionId,
    seats,
    rostered,
  }: {
    sessionId: string;
    seats: SessionSeats;
    /** The viewer has a confirmed seat at the table: they may sign up. */
    rostered: boolean;
  } = $props();

  const full = $derived(seats.going >= seats.size);
  const failed = (form: { message?: { code: string; retryAfter?: number } } | undefined) =>
    toast.error(registrationError(form?.message?.code ?? 'invalid', form?.message?.retryAfter));
</script>

{#snippet post(action: string, label: string, success: string, primary: boolean)}
  <PostButton
    {action}
    fields={{ sessionId }}
    schema={sessionSignupSchema}
    domain="table"
    errorMessage={() => registrationError('invalid')}
    {success}
    onFailure={failed}
    class="mt-2"
    buttonClass="btn h-11 rounded-lg px-4 font-semibold {primary
      ? 'preset-filled-primary-500'
      : 'btn-secondary'}">{label}</PostButton
  >
{/snippet}

<div class="mt-1 flex flex-col">
  <span class="flex flex-wrap items-center gap-2 text-sm text-muted">
    <span aria-label={m.sessions_seats_label({ going: seats.going, size: seats.size })}
      >{m.sessions_seats({ going: seats.going, size: seats.size })}</span
    >
    {#if full && seats.mine !== 'going'}
      <span
        class="inline-flex h-7 items-center rounded-lg bg-lamp-wash px-3 text-sm font-semibold whitespace-nowrap"
        >{m.sessions_signup_full()}</span
      >
    {/if}
  </span>

  {#if rostered}
    {#if seats.mine === 'going'}
      <p class="mt-1 text-sm font-semibold">{m.sessions_signup_going()}</p>
      {@render post(
        '?/sessionLeave',
        m.sessions_signup_leave(),
        m.toast_session_signup_left(),
        false,
      )}
    {:else if seats.mine === 'waiting'}
      <p class="mt-1 text-sm font-semibold">
        {m.sessions_signup_position({ position: seats.position ?? 1 })}
      </p>
      <p class="text-sm text-muted">{m.sessions_signup_position_hint()}</p>
      {@render post(
        '?/sessionLeave',
        m.sessions_signup_unwait(),
        m.toast_session_signup_left(),
        false,
      )}
    {:else if full}
      <p class="mt-1 text-sm text-muted">{m.sessions_signup_waiting({ count: seats.waiting })}</p>
      {@render post(
        '?/sessionSignup',
        m.sessions_signup_wait(),
        m.toast_session_signup_waiting(),
        false,
      )}
    {:else}
      {@render post(
        '?/sessionSignup',
        m.sessions_signup_join(),
        m.toast_session_signup_going(),
        true,
      )}
    {/if}
  {/if}
</div>
