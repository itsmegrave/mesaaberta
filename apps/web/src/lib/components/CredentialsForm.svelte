<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import MAForm from './ui/MAForm.svelte';
  import EmailField from './ui/EmailField.svelte';
  import PasswordField from './ui/PasswordField.svelte';
  import type { CredentialsData } from '#lib/auth/credentials.js';
  import { m } from '#lib/paraglide/messages.js';

  type Props = {
    mode: 'login' | 'signup';
    controller: ReturnType<typeof actionForm<CredentialsData>>;
    action?: string;
  };

  let { mode, controller, action }: Props = $props();

  const messages: Record<string, () => string> = {
    invalid: m.auth_error_invalid,
    unconfirmed: m.auth_error_unconfirmed,
    suspended: m.auth_error_suspended,
    weak_password: m.auth_error_weak,
    rate_limited: m.auth_error_rate_limited,
    failed: m.auth_error_failed,
  };
</script>

<MAForm {action} onsubmit={controller.submit} onfocusout={controller.blur} class="grid gap-4">
  <FormBanner text={controller.message ? messages[controller.message.code]?.() : null} />

  <input type="hidden" name="next" value={controller.values.next} />

  <EmailField
    bind:value={() => controller.values.email, (value) => controller.change('email', value)}
    error={controller.errors.email ? m.auth_error_email() : undefined}
  />

  <PasswordField
    id="password"
    name="password"
    label={m.auth_password()}
    hint={mode === 'signup' ? m.auth_password_hint() : undefined}
    error={controller.errors.password ? m.auth_error_password() : undefined}
    autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
    bind:value={() => controller.values.password, (value) => controller.change('password', value)}
  />

  <div>
    <MAButton
      type="submit"
      size="custom"
      {controller}
      class="btn h-11 w-full gap-2 rounded-lg preset-filled-primary-500 text-base font-semibold"
    >
      {mode === 'signup' ? m.signup_submit() : m.login_submit()}
    </MAButton>
  </div>
</MAForm>
