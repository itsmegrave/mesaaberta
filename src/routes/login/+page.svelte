<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { resolve } from '$app/paths';
  import CredentialsForm from '$lib/components/CredentialsForm.svelte';
  import LegalConsent from '$lib/components/LegalConsent.svelte';
  import ProviderButtons from '$lib/components/ProviderButtons.svelte';
  import AuthShell from '$lib/components/AuthShell.svelte';
  import { credentialsSchema } from '$lib/auth/credentials';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
  const superform = superForm(data.form, { validators: zod4Client(credentialsSchema) });
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
      {data.confirmHint ? m.login_confirmed_hint() : m.login_failed()}
    </p>
  {/if}

  {#if data.authEnabled}
    <div class="grid gap-5">
      <CredentialsForm mode="login" {superform} action="?/email" />

      <p>
        <a href={resolve('/forgot-password')} class="link-underline font-semibold text-link"
          >{m.login_forgot()}</a
        >
      </p>

      <p class="flex items-center gap-3" aria-hidden="true">
        <span class="h-px grow bg-surface-200-800"></span>
        <span class="text-sm font-semibold text-muted">{m.login_or()}</span>
        <span class="h-px grow bg-surface-200-800"></span>
      </p>

      <ProviderButtons next={data.next} />

      <LegalConsent mode="login" />

      <p>
        {m.login_no_account()}
        <a
          href="{resolve('/signup')}?next={encodeURIComponent(data.next)}"
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
