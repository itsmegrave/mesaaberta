<script lang="ts">
  // "Contas conectadas": the ways to sign in to this account, on the edit profile page only. Connect
  // starts the provider's own flow (a link, see /account/connect); disconnect is a form that never
  // takes the last way in. Nothing here is public: no provider shows on the profile.
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import DisconnectProvider from '$lib/components/DisconnectProvider.svelte';
  import ProviderLogo from '$lib/components/ProviderLogo.svelte';
  import { m } from '$lib/paraglide/messages';
  import type { Provider } from '$lib/auth/providers';

  type Props = {
    connections: {
      providers: { provider: Provider; connected: boolean }[];
      email: boolean;
      total: number;
    };
    class?: string;
  };
  let { connections, class: className = '' }: Props = $props();

  const labels: Record<Provider, () => string> = {
    google: m.network_google,
    discord: m.network_discord,
  };

  const notices: Record<string, () => string> = {
    conectada: m.account_connections_connected_notice,
    desconectada: m.account_connections_disconnected_notice,
    de_outra_pessoa: m.account_connections_other_person,
    falhou: m.account_connections_failed,
    indisponivel: m.account_connections_failed,
  };
  const notice = $derived(notices[page.url.searchParams.get('conta') ?? '']?.());
</script>

<section aria-labelledby="connected-accounts" class={className}>
  <h2 id="connected-accounts" class="text-2xl leading-tight font-semibold tracking-tight">
    {m.account_connections_title()}
  </h2>
  <p class="mt-3 max-w-prose text-muted">{m.account_connections_text()}</p>

  {#if notice}
    <p role="status" class="mt-3 text-sm font-semibold">{notice}</p>
  {/if}
  <ul class="mt-5 grid gap-3">
    {#each connections.providers as { provider, connected } (provider)}
      <li
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200-800 p-3"
      >
        <span class="flex items-center gap-3 font-semibold">
          <ProviderLogo {provider} />
          {labels[provider]()}
          <span class="text-sm font-normal text-muted">
            {connected ? m.account_connections_state_on() : m.account_connections_state_off()}
          </span>
        </span>
        {#if connected}
          {#if connections.total > 1}
            <DisconnectProvider {provider} label={labels[provider]()} />
          {/if}
        {:else}
          <a
            href={resolve('/account/connect/[provider=provider]', { provider })}
            data-sveltekit-reload
            class="btn h-12 rounded-lg border-2 border-primary-500 px-5 font-semibold"
          >
            {m.account_connections_connect({ provider: labels[provider]() })}
          </a>
        {/if}
      </li>
    {/each}
    {#if connections.email}
      <li
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200-800 p-3"
      >
        <span class="font-semibold">{m.account_connections_email()}</span>
        <span class="text-sm text-muted">{m.account_connections_state_on()}</span>
      </li>
    {/if}
  </ul>
  {#if connections.total < 2}
    <p class="mt-3 text-sm text-muted">{m.account_connections_last_hint()}</p>
  {/if}
</section>
