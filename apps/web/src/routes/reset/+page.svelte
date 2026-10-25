<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import AuthShell from '#lib/components/ui/AuthShell.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import PasswordField from '#lib/components/ui/PasswordField.svelte';
  import { resolve } from '$app/paths';
  import { newPasswordSchema } from '#lib/auth/credentials.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    ...fromResult(result?.form ?? data.form),
    schema: newPasswordSchema,
    domain: 'account',
    onSuccess: () => {},
    errorMessage: m.auth_error_failed,
  });
  const problem = $derived(
    controller.message?.code === 'weak_password'
      ? m.auth_error_weak()
      : controller.message?.code === 'same_password'
        ? m.auth_error_same()
        : controller.message?.code === 'rate_limited'
          ? m.auth_error_rate_limited()
          : controller.message
            ? m.auth_error_failed()
            : null,
  );
</script>

<svelte:head>
  <title>{m.reset_title()}</title>
</svelte:head>

<AuthShell
  title={data.done ? m.reset_done_title() : m.reset_title()}
  lede={data.done ? undefined : m.reset_lede()}
  parents={[{ label: m.login_title(), href: '/login' }]}
>
  {#if data.done}
    <p role="status" class="max-w-sm text-lg">{m.reset_done_text()}</p>
    <a href="/t" class="mt-6 inline-block link-underline font-semibold text-link">
      {m.reset_done_link()}
    </a>
  {:else}
    <MAForm onsubmit={controller.submit} class="grid gap-4">
      <FormBanner text={problem} />

      <PasswordField
        id="password"
        name="password"
        label={m.reset_password()}
        hint={m.auth_password_hint()}
        error={controller.errors.password ? m.auth_error_password() : undefined}
        autocomplete="new-password"
        bind:value={
          () => controller.values.password, (value) => controller.change('password', value)
        }
      />

      <PasswordField
        id="passwordConfirm"
        name="passwordConfirm"
        label={m.reset_confirm()}
        error={controller.errors.passwordConfirm ? m.auth_error_mismatch() : undefined}
        autocomplete="new-password"
        bind:value={
          () => controller.values.passwordConfirm,
          (value) => controller.change('passwordConfirm', value)
        }
      />

      <div>
        <MAButton
          type="submit"
          size="custom"
          {controller}
          class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 text-base font-semibold"
        >
          {m.reset_submit()}
        </MAButton>
      </div>
    </MAForm>

    <p class="mt-8">
      {m.forgot_remembered()}
      <a href={resolve('login')} class="anchor">{m.login_title()}</a>
    </p>
  {/if}
</AuthShell>
