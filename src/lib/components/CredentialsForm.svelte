<script lang="ts">
  import FormBanner from '$lib/components/FormBanner.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from './Form.svelte';
  import TextInput from './TextInput.svelte';
  import FormField from './FormField.svelte';
  import type { CredentialsData } from '$lib/auth/credentials';
  import { m } from '$lib/paraglide/messages';

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

<Form {action} onsubmit={controller.submit} class="grid gap-4">
  <FormBanner text={controller.message ? messages[controller.message.code]?.() : null} />

  <input type="hidden" name="next" value={controller.values.next} />

  <FormField
    id="email"
    label={m.auth_email()}
    error={controller.errors.email ? m.auth_error_email() : undefined}
  >
    <TextInput
      id="email"
      name="email"
      type="email"
      required
      autocomplete="email"
      bind:value={() => controller.values.email, (value) => controller.change('email', value)}
      class="border-2 border-surface-600-400 bg-panel px-4 text-base"
      aria-invalid={controller.errors.email ? 'true' : undefined}
    />
  </FormField>

  <FormField
    id="password"
    label={m.auth_password()}
    hint={mode === 'signup' ? m.auth_password_hint() : undefined}
    error={controller.errors.password ? m.auth_error_password() : undefined}
  >
    <TextInput
      id="password"
      name="password"
      type="password"
      required
      minlength={8}
      maxlength={72}
      autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
      bind:value={() => controller.values.password, (value) => controller.change('password', value)}
      class="border-2 border-surface-600-400 bg-panel px-4 text-base"
      aria-invalid={controller.errors.password ? 'true' : undefined}
    />
  </FormField>

  <div>
    <SubmitButton
      submitting={controller.pending}
      delayed={controller.delayed}
      timeout={controller.timeout}
      class="btn h-12 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
    >
      {mode === 'signup' ? m.signup_submit() : m.login_submit()}
    </SubmitButton>
  </div>
</Form>
