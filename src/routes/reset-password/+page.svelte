<script lang="ts">
  import AuthShell from '$lib/components/AuthShell.svelte';
  import { superForm } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import { resolve } from '$app/paths';
  import { newPasswordSchema } from '$lib/auth/credentials';
  import FormField from '$lib/components/FormField.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const { form, errors, message, enhance, delayed } = superForm(data.form, {
    validators: zod4Client(newPasswordSchema),
  });
  const problem = $derived(
    $message?.code === 'weak_password'
      ? m.auth_error_weak()
      : $message?.code === 'same_password'
        ? m.auth_error_same()
        : $message?.code === 'rate_limited'
          ? m.auth_error_rate_limited()
          : $message
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
>
  {#if data.done}
    <p role="status" class="max-w-[44ch] text-lg">{m.reset_done_text()}</p>
    <a
      href={localizedHref('/tables', getLocale())}
      class="mt-6 inline-block link-underline font-semibold text-link"
    >
      {m.reset_done_link()}
    </a>
  {:else}
    <form method="POST" use:enhance class="grid gap-4">
      {#if problem}<p role="alert" class="font-semibold text-error-700-300">{problem}</p>{/if}

      <FormField
        id="password"
        label={m.reset_password()}
        hint={m.auth_password_hint()}
        error={$errors.password ? m.auth_error_password() : undefined}
      >
        <input
          id="password"
          name="password"
          type="password"
          required
          minlength="8"
          maxlength="72"
          autocomplete="new-password"
          bind:value={$form.password}
          class="input h-13 rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
          aria-invalid={$errors.password ? 'true' : undefined}
        />
      </FormField>

      <FormField
        id="passwordConfirm"
        label={m.reset_confirm()}
        error={$errors.passwordConfirm ? m.auth_error_mismatch() : undefined}
      >
        <input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minlength="8"
          maxlength="72"
          autocomplete="new-password"
          bind:value={$form.passwordConfirm}
          class="input h-13 rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
          aria-invalid={$errors.passwordConfirm ? 'true' : undefined}
        />
      </FormField>

      <div>
        <button
          type="submit"
          class="btn h-13 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
          aria-busy={$delayed}
        >
          {m.reset_submit()}
        </button>
      </div>
    </form>

    <p class="mt-8"><a href={resolve('/login')} class="anchor">{m.forgot_back()}</a></p>
  {/if}
</AuthShell>
