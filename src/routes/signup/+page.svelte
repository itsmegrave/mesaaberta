<script lang="ts">
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { resolve } from '$app/paths';
  import AuthShell from '$lib/components/AuthShell.svelte';
  import CredentialsForm from '$lib/components/CredentialsForm.svelte';
  import LegalConsent from '$lib/components/LegalConsent.svelte';
  import ProviderButtons from '$lib/components/ProviderButtons.svelte';
  import { credentialsSchema } from '$lib/auth/credentials';
  import { m } from '$lib/paraglide/messages';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = result?.form ?? data.form;
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
    schema: credentialsSchema,
    domain: 'account',
    onSuccess: () => {},
    errorMessage: m.auth_error_failed,
  });
</script>

<svelte:head>
  <title>{m.signup_title()}</title>
</svelte:head>

<AuthShell
  title={m.signup_title()}
  lede={data.authEnabled && controller.message?.code !== 'check_email'
    ? m.signup_lede()
    : undefined}
>
  {#if !data.authEnabled}
    <p class="max-w-sm">{m.login_unavailable()}</p>
  {:else if controller.message?.code === 'check_email'}
    <div role="status" class="rounded-lg border border-surface-200-800 bg-panel p-6">
      <h2 class="text-2xl font-semibold">{m.signup_check_email_title()}</h2>
      <p class="mt-3 text-lg">{m.signup_check_email_text()}</p>
      <a
        href="{resolve('/login')}?next={encodeURIComponent(data.next)}"
        class="mt-4 inline-block link-underline font-semibold text-link"
      >
        {m.signup_sign_in()}
      </a>
    </div>
  {:else}
    <div class="grid gap-5">
      <CredentialsForm mode="signup" {controller} />

      <p class="flex items-center gap-3" aria-hidden="true">
        <span class="h-px grow bg-surface-200-800"></span>
        <span class="text-sm font-semibold text-muted">{m.login_or()}</span>
        <span class="h-px grow bg-surface-200-800"></span>
      </p>

      <ProviderButtons next={data.next} />

      <LegalConsent mode="signup" />

      <p>
        {m.signup_have_account()}
        <a
          href="{resolve('/login')}?next={encodeURIComponent(data.next)}"
          class="link-underline font-semibold text-link"
        >
          {m.signup_sign_in()}
        </a>
      </p>
    </div>
  {/if}
</AuthShell>
