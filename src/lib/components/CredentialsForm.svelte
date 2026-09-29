<script lang="ts">
  import FormBanner from '$lib/components/FormBanner.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import type { SuperForm } from 'sveltekit-superforms';
  import FormField from './FormField.svelte';
  import type { CredentialsData } from '$lib/auth/credentials';
  import type { FormMessage } from '$lib/forms/message';
  import { m } from '$lib/paraglide/messages';

  type Props = {
    mode: 'login' | 'signup';
    superform: SuperForm<CredentialsData, FormMessage>;
    action?: string;
  };

  let { mode, superform, action }: Props = $props();
  // svelte-ignore state_referenced_locally
  const { form, errors, message, enhance, submitting, delayed, timeout } = superform;

  const messages: Record<string, () => string> = {
    invalid: m.auth_error_invalid,
    unconfirmed: m.auth_error_unconfirmed,
    weak_password: m.auth_error_weak,
    rate_limited: m.auth_error_rate_limited,
    failed: m.auth_error_failed,
  };
</script>

<form method="POST" {action} use:enhance class="grid gap-4">
  <FormBanner text={$message ? messages[$message.code]?.() : null} />

  <input type="hidden" name="next" value={$form.next} />

  <FormField
    id="email"
    label={m.auth_email()}
    error={$errors.email ? m.auth_error_email() : undefined}
  >
    <input
      id="email"
      name="email"
      type="email"
      required
      autocomplete="email"
      bind:value={$form.email}
      class="input h-12 rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
      aria-invalid={$errors.email ? 'true' : undefined}
    />
  </FormField>

  <FormField
    id="password"
    label={m.auth_password()}
    hint={mode === 'signup' ? m.auth_password_hint() : undefined}
    error={$errors.password ? m.auth_error_password() : undefined}
  >
    <input
      id="password"
      name="password"
      type="password"
      required
      minlength="8"
      maxlength="72"
      autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
      bind:value={$form.password}
      class="input h-12 rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
      aria-invalid={$errors.password ? 'true' : undefined}
    />
  </FormField>

  <div>
    <SubmitButton
      submitting={$submitting}
      delayed={$delayed}
      timeout={$timeout}
      class="btn h-12 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
    >
      {mode === 'signup' ? m.signup_submit() : m.login_submit()}
    </SubmitButton>
  </div>
</form>
