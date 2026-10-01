<script lang="ts">
  // The GM's answer to "did the session happen?", once its date has passed: it happened (players are
  // asked to rate), it did not, or a new date (the table opens again until then).
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { answerSchema, postponeSchema } from '$lib/tables/confirmation';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let { next }: { next: string } = $props();

  const primary = 'btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold';
  const secondary =
    'btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';

  // svelte-ignore state_referenced_locally
  const initial = { next };
  const happened = actionForm({
    initial,
    schema: answerSchema,
    domain: 'table',
    errorMessage: m.manage_confirm_error,
    onSuccess: () => toast.success(m.toast_table_concluded()),
  });
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
    <Form action="?/happened" onsubmit={happened.submit} class="m-0">
      <input type="hidden" name="next" value={next} />
      <SubmitButton
        submitting={happened.pending}
        delayed={happened.delayed}
        timeout={happened.timeout}
        class={primary}>{m.manage_confirm_happened()}</SubmitButton
      >
      {#if happened.errors._errors?.[0]}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
          {happened.errors._errors[0]}
        </p>
      {/if}
    </Form>
    <Form action="?/notHeld" onsubmit={notHeld.submit} class="m-0">
      <input type="hidden" name="next" value={next} />
      <SubmitButton
        submitting={notHeld.pending}
        delayed={notHeld.delayed}
        timeout={notHeld.timeout}
        class={secondary}>{m.manage_confirm_not_held()}</SubmitButton
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
    <SubmitButton
      submitting={postpone.pending}
      delayed={postpone.delayed}
      timeout={postpone.timeout}
      class={secondary}>{m.manage_confirm_postpone()}</SubmitButton
    >
    {#if postponeError}
      <p role="alert" class="w-full text-sm font-semibold text-error-700-300">{postponeError}</p>
    {/if}
  </Form>
</section>
