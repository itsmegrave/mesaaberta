<script lang="ts">
  // "Criar uma senha": for an account that signs in with a provider only. Two steps on the profile
  // page, both done by the api: it e-mails a code to the account's address, then the code and the new
  // password go back together. Nothing typed is handed back by the server, not even the length.
  import { z } from 'zod';
  import { addPasswordFormSchema } from '@mesaaberta/core/auth/password-setup';
  import FormBanner from '#lib/components/FormBanner.svelte';
  import Form from '#lib/components/Form.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import SubmitButton from '#lib/components/SubmitButton.svelte';
  import TextInput from '#lib/components/TextInput.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let { class: className = '' }: { class?: string } = $props();

  let sent = $state(false);
  let done = $state(false);

  const problems: Record<string, () => string> = {
    wrong_code: m.password_add_error_wrong_code,
    code_expired: m.password_add_error_code_expired,
    weak_password: m.auth_error_weak,
    already_set: m.password_add_error_already_set,
    no_email: m.password_add_error_no_email,
    no_session: m.password_add_error_no_session,
    rate_limited: m.auth_error_rate_limited,
    unavailable: m.password_add_error_unavailable,
  };

  const asking = actionForm({
    initial: {},
    schema: z.object({}),
    domain: 'account',
    refresh: false,
    onSuccess: () => {
      sent = true;
    },
    errorMessage: m.password_add_error_unavailable,
  });
  const setting = actionForm({
    initial: { code: '', password: '', passwordConfirm: '' },
    schema: addPasswordFormSchema,
    domain: 'account',
    refresh: false,
    onSuccess: () => {
      done = true;
      toast.success(m.password_add_done());
    },
    errorMessage: m.password_add_error_unavailable,
  });

  const banner = $derived(
    (setting.message?.code && problems[setting.message.code]?.()) ||
      (asking.message?.code && problems[asking.message.code]?.()) ||
      null,
  );
  const fieldProblem = (field: 'code' | 'password') => {
    const code = setting.errors[field]?.[0];
    return code
      ? (problems[code] ?? (field === 'code' ? m.password_add_error_code : m.auth_error_password))()
      : undefined;
  };
</script>

<section aria-labelledby="add-password" class={className}>
  <h2 id="add-password" class="text-2xl leading-tight font-semibold tracking-tight">
    {m.password_add_title()}
  </h2>

  {#if done}
    <p role="status" class="mt-3 max-w-prose font-semibold">{m.password_add_done()}</p>
  {:else}
    <p class="mt-3 max-w-prose text-muted">{m.password_add_text()}</p>
    <FormBanner text={banner} />

    {#if !sent}
      <Form action="?/passwordCode" onsubmit={asking.submit} class="mt-5">
        <SubmitButton
          submitting={asking.pending}
          delayed={asking.delayed}
          timeout={asking.timeout}
          class="btn h-12 rounded-lg border-2 border-primary-500 px-5 font-semibold"
        >
          {m.password_add_send()}
        </SubmitButton>
      </Form>
    {:else}
      <p role="status" class="mt-3 text-sm font-semibold">{m.password_add_sent()}</p>
      <Form action="?/addPassword" onsubmit={setting.submit} class="mt-5 grid max-w-sm gap-4">
        <FormField id="password-code" label={m.password_add_code()} error={fieldProblem('code')}>
          <TextInput
            id="password-code"
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
            minlength={6}
            maxlength={6}
            bind:value={() => setting.values.code, (value) => setting.change('code', value)}
            class="input h-12 w-full rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
            aria-invalid={setting.errors.code ? 'true' : undefined}
          />
        </FormField>

        <FormField
          id="password-new"
          label={m.password_add_password()}
          hint={m.auth_password_hint()}
          error={fieldProblem('password')}
        >
          <TextInput
            id="password-new"
            name="password"
            type="password"
            required
            minlength={8}
            maxlength={72}
            autocomplete="new-password"
            bind:value={() => setting.values.password, (value) => setting.change('password', value)}
            class="input h-12 w-full rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
            aria-invalid={setting.errors.password ? 'true' : undefined}
          />
        </FormField>

        <FormField
          id="password-confirm"
          label={m.password_add_confirm()}
          error={setting.errors.passwordConfirm ? m.auth_error_mismatch() : undefined}
        >
          <TextInput
            id="password-confirm"
            name="passwordConfirm"
            type="password"
            required
            minlength={8}
            maxlength={72}
            autocomplete="new-password"
            bind:value={
              () => setting.values.passwordConfirm,
              (value) => setting.change('passwordConfirm', value)
            }
            class="input h-12 w-full rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
            aria-invalid={setting.errors.passwordConfirm ? 'true' : undefined}
          />
        </FormField>

        <SubmitButton
          submitting={setting.pending}
          delayed={setting.delayed}
          timeout={setting.timeout}
          class="btn h-12 rounded-lg preset-filled-primary-500 text-base font-semibold"
        >
          {m.password_add_submit()}
        </SubmitButton>
      </Form>

      <Form action="?/passwordCode" onsubmit={asking.submit} class="mt-3">
        <SubmitButton
          submitting={asking.pending}
          delayed={asking.delayed}
          timeout={asking.timeout}
          class="btn h-12 rounded-lg px-0 link-underline font-semibold text-link"
        >
          {m.password_add_resend()}
        </SubmitButton>
      </Form>
    {/if}
  {/if}
</section>
