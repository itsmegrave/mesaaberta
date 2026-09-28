<script lang="ts">
  import AuthShell from '$lib/components/AuthShell.svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { resolve } from '$app/paths';
  import { emailSchema } from '$lib/auth/credentials';
  import FormField from '$lib/components/FormField.svelte';
  import { m } from '$lib/paraglide/messages';

  let { data } = $props();
  const { form, errors, message, enhance, delayed } = superForm(data.form, {
    validators: zod4Client(emailSchema),
  });
</script>

<svelte:head>
  <title>{m.forgot_title()}</title>
</svelte:head>

<AuthShell title={m.forgot_title()}>
  {#if !data.authEnabled}
    <p class="max-w-sm">{m.login_unavailable()}</p>
  {:else if $message?.code === 'sent'}
    <div role="status" class="rounded-lg border border-surface-200-800 bg-panel p-6">
      <h2 class="text-2xl font-semibold">{m.forgot_sent_title()}</h2>
      <p class="mt-3 text-lg">{m.forgot_sent_text()}</p>
    </div>
  {:else}
    <p class="max-w-sm text-lg text-muted">{m.forgot_lede()}</p>

    {#if data.linkExpired}
      <p role="alert" class="mt-6 max-w-sm font-semibold">{m.forgot_link_expired()}</p>
    {/if}

    <form method="POST" use:enhance class="mt-6 grid gap-4">
      {#if $message}
        <p role="alert" class="font-semibold text-error-700-300">
          {$message.code === 'rate_limited' ? m.auth_error_rate_limited() : m.auth_error_failed()}
        </p>
      {/if}

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

      <div>
        <button
          type="submit"
          class="btn h-12 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
          aria-busy={$delayed}
        >
          {m.forgot_submit()}
        </button>
      </div>
    </form>
  {/if}

  <p class="mt-8">
    <a href={resolve('/login')} class="link-underline font-semibold text-link">{m.forgot_back()}</a>
  </p>
</AuthShell>
