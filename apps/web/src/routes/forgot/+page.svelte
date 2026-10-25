<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import AuthShell from '#lib/components/ui/AuthShell.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult } from '#lib/forms/contract.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import EmailField from '#lib/components/ui/EmailField.svelte';
  import { resolve } from '$app/paths';
  import { emailSchema } from '#lib/auth/credentials.js';
  import { m } from '#lib/paraglide/messages.js';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    ...fromResult(result?.form ?? data.form),
    schema: emailSchema,
    domain: 'account',
    onSuccess: () => {},
    errorMessage: m.auth_error_failed,
  });
</script>

<svelte:head>
  <title>{m.forgot_title()}</title>
</svelte:head>

<AuthShell title={m.forgot_title()} parents={[{ label: m.login_title(), href: '/login' }]}>
  {#if !data.authEnabled}
    <p class="max-w-sm">{m.login_unavailable()}</p>
  {:else if controller.message?.code === 'sent'}
    <div role="status" class="rounded-lg border border-surface-200-800 bg-panel p-6">
      <h2 class="text-2xl font-semibold">{m.forgot_sent_title()}</h2>
      <p class="mt-3 text-lg">{m.forgot_sent_text()}</p>
    </div>
  {:else}
    <p class="max-w-sm text-lg text-muted">{m.forgot_lede()}</p>

    {#if data.linkExpired}
      <p role="alert" class="mt-6 max-w-sm font-semibold">{m.forgot_link_expired()}</p>
    {/if}

    <MAForm onsubmit={controller.submit} class="mt-6 grid gap-4">
      <FormBanner
        text={controller.message
          ? controller.message.code === 'rate_limited'
            ? m.auth_error_rate_limited()
            : m.auth_error_failed()
          : null}
      />

      <EmailField
        bind:value={() => controller.values.email, (value) => controller.change('email', value)}
        error={controller.errors.email ? m.auth_error_email() : undefined}
      />

      <div>
        <MAButton
          type="submit"
          size="custom"
          {controller}
          class="btn h-12 w-full gap-2 rounded-lg preset-filled-primary-500 text-base font-semibold"
        >
          {m.forgot_submit()}
        </MAButton>
      </div>
    </MAForm>
  {/if}

  <p class="mt-8">
    {m.forgot_remembered()}

    <a href={resolve('login')} class="link-underline font-semibold text-link">{m.login_title()}</a>
  </p>
</AuthShell>
