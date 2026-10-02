<script lang="ts">
  import FormBanner from '$lib/components/FormBanner.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AuthShell from '$lib/components/AuthShell.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { resolve } from '$app/paths';
  import { emailSchema } from '$lib/auth/credentials';
  import FormField from '$lib/components/FormField.svelte';
  import { m } from '$lib/paraglide/messages';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = result?.form ?? data.form;
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
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

    <Form onsubmit={controller.submit} class="mt-6 grid gap-4">
      <FormBanner
        text={controller.message
          ? controller.message.code === 'rate_limited'
            ? m.auth_error_rate_limited()
            : m.auth_error_failed()
          : null}
      />

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
          class="input h-12 w-full rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
          aria-invalid={controller.errors.email ? 'true' : undefined}
        />
      </FormField>

      <div>
        <SubmitButton
          submitting={controller.pending}
          delayed={controller.delayed}
          timeout={controller.timeout}
          class="btn h-12 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
        >
          {m.forgot_submit()}
        </SubmitButton>
      </div>
    </Form>
  {/if}

  <p class="mt-8">
    {m.forgot_remembered()}
    <a href={resolve('/login')} class="link-underline font-semibold text-link">{m.login_title()}</a>
  </p>
</AuthShell>
