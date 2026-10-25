<script lang="ts">
  // The button that disconnects one provider from the account, and why the server refused if it did.
  import PostButton from '#lib/components/PostButton.svelte';
  import { disconnectSchema } from '#lib/profile/connections.js';
  import { m } from '#lib/paraglide/messages.js';
  import type { Provider } from '@mesaaberta/core/auth/providers';

  let { provider, label }: { provider: Provider; label: string } = $props();

  const errors: Record<string, () => string> = {
    last_identity: m.account_connections_last,
    not_connected: m.account_connections_failed,
    unlink_failed: m.account_connections_failed,
  };
</script>

<PostButton
  action="?/disconnect"
  fields={{ provider }}
  schema={disconnectSchema}
  domain="account"
  errorMessage={m.account_connections_failed}
  success={m.account_connections_disconnected_notice()}
  error={(refused) => {
    const code = refused.provider?.[0];
    return code ? (errors[code] ?? m.account_connections_failed)() : undefined;
  }}
  errorClass=""
  class="grid justify-items-end gap-2"
  buttonClass="btn h-12 rounded-lg btn-secondary px-5 font-semibold"
>
  {m.account_connections_disconnect({ provider: label })}
</PostButton>
