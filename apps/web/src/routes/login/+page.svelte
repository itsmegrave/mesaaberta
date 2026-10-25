<script lang="ts">
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import { resolve } from '$app/paths';
  import CredentialsForm from '#lib/components/CredentialsForm.svelte';
  import LegalConsent from '#lib/components/LegalConsent.svelte';
  import ProviderButtons from '#lib/components/ProviderButtons.svelte';
  import AuthDivider from '#lib/components/AuthDivider.svelte';
  import AuthShell from '#lib/components/AuthShell.svelte';
  import { credentialsSchema } from '#lib/auth/credentials.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    ...fromResult(result?.form ?? data.form),
    schema: credentialsSchema,
    domain: 'account',
    onSuccess: () => {},
    errorMessage: m.auth_error_failed,
  });
</script>

<svelte:head>
  <title>{m.login_title()}</title>
</svelte:head>

<AuthShell title={m.login_title()} lede={m.login_lede()}>
  {#if data.failed}
    <p
      role="alert"
      class="mb-5 rounded-lg border-2 border-error-alert bg-panel px-4 py-3 font-semibold"
    >
      {data.suspended
        ? m.login_suspended()
        : data.confirmHint
          ? m.login_confirmed_hint()
          : m.login_failed()}
    </p>
  {/if}

  {#if data.authEnabled}
    <div class="grid gap-5">
      <CredentialsForm mode="login" {controller} action="?/email" />

      <p>
        <a href="/forgot" class="link-underline font-semibold text-link">{m.login_forgot()}</a>
      </p>

      <AuthDivider />

      <ProviderButtons next={data.next} />

      <LegalConsent mode="login" />

      <p>
        {m.login_no_account()}
        <a
          href="{resolve('signup')}?next={encodeURIComponent(data.next)}"
          class="link-underline font-semibold text-link"
        >
          {m.login_create_account()}
        </a>
      </p>
    </div>
  {:else}
    <p class="max-w-sm">{m.login_unavailable()}</p>
  {/if}
</AuthShell>
