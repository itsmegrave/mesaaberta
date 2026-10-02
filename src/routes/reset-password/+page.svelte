<script lang="ts">
  import FormBanner from '$lib/components/FormBanner.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AuthShell from '$lib/components/AuthShell.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import { resolve } from '$app/paths';
  import { newPasswordSchema } from '$lib/auth/credentials';
  import FormField from '$lib/components/FormField.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data, form: result = null } = $props();
  // svelte-ignore state_referenced_locally
  const initial = result?.form ?? data.form;
  const controller = actionForm({
    initial: initial.data,
    initialErrors: initial.errors,
    initialMessage: initial.message,
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
>
  {#if data.done}
    <p role="status" class="max-w-sm text-lg">{m.reset_done_text()}</p>
    <a
      href={localizedHref('/tables', getLocale())}
      class="mt-6 inline-block link-underline font-semibold text-link"
    >
      {m.reset_done_link()}
    </a>
  {:else}
    <Form onsubmit={controller.submit} class="grid gap-4">
      <FormBanner text={problem} />

      <FormField
        id="password"
        label={m.reset_password()}
        hint={m.auth_password_hint()}
        error={controller.errors.password ? m.auth_error_password() : undefined}
      >
        <TextInput
          id="password"
          name="password"
          type="password"
          required
          minlength={8}
          maxlength={72}
          autocomplete="new-password"
          bind:value={
            () => controller.values.password, (value) => controller.change('password', value)
          }
          class="border-2 border-surface-600-400 bg-panel px-4 text-base"
          aria-invalid={controller.errors.password ? 'true' : undefined}
        />
      </FormField>

      <FormField
        id="passwordConfirm"
        label={m.reset_confirm()}
        error={controller.errors.passwordConfirm ? m.auth_error_mismatch() : undefined}
      >
        <TextInput
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          required
          minlength={8}
          maxlength={72}
          autocomplete="new-password"
          bind:value={
            () => controller.values.passwordConfirm,
            (value) => controller.change('passwordConfirm', value)
          }
          class="border-2 border-surface-600-400 bg-panel px-4 text-base"
          aria-invalid={controller.errors.passwordConfirm ? 'true' : undefined}
        />
      </FormField>

      <div>
        <SubmitButton
          submitting={controller.pending}
          delayed={controller.delayed}
          timeout={controller.timeout}
          class="btn h-12 w-full rounded-lg preset-filled-primary-500 text-base font-semibold"
        >
          {m.reset_submit()}
        </SubmitButton>
      </div>
    </Form>

    <p class="mt-8"><a href={resolve('/login')} class="anchor">{m.forgot_back()}</a></p>
  {/if}
</AuthShell>
