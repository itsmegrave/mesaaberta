<script lang="ts">
  // "Conta e acesso": the email and the @usuário (both read-only here), the ways to sign in and,
  // for an account without one, creating a password.
  import AddPassword from './components/AddPassword.svelte';
  import ConnectedAccounts from './components/ConnectedAccounts.svelte';
  import FormField from '#lib/components/FormField.svelte';
  import SettingsSection from '../components/SettingsSection.svelte';
  import TextInput from '#lib/components/TextInput.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { data } = $props();

  const card = 'rounded-lg border border-surface-200-800 bg-panel p-6 md:p-8';
  const readonly =
    'input h-12 w-full rounded-lg border-surface-200-800 bg-surface-950-50/5 px-3 text-muted';
</script>

<SettingsSection title={m.profile_section_account()} lede={m.profile_section_account_lede()} />

<section aria-labelledby="details" class={card}>
  <h3 id="details" class="text-2xl leading-tight font-semibold tracking-tight">
    {m.account_identity()}
  </h3>
  <div class="mt-6 grid max-w-xl gap-6">
    <FormField id="email" label={m.account_email()} hint={m.account_email_hint()}>
      <TextInput
        id="email"
        type="email"
        value={data.email}
        readonly
        aria-describedby="email-hint"
        class={readonly}
      />
    </FormField>
    <FormField id="username" label={m.profile_username()} hint={m.profile_username_locked_hint()}>
      <TextInput
        id="username"
        type="text"
        value={data.username}
        readonly
        aria-describedby="username-hint"
        class={readonly}
      />
    </FormField>
  </div>
</section>

{#if data.connections}
  <ConnectedAccounts connections={data.connections} class={card} />
{/if}

{#if data.canAddPassword}
  <AddPassword class={card} />
{/if}
