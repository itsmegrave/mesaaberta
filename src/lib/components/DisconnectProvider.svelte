<script lang="ts">
  // The button that disconnects one provider from the account, and why the server refused if it did.
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import Form from '$lib/components/Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { disconnectSchema } from '$lib/profile/connections';
  import { m } from '$lib/paraglide/messages';
  import type { Provider } from '$lib/auth/providers';

  let { provider, label }: { provider: Provider; label: string } = $props();

  const errors: Record<string, () => string> = {
    last_identity: m.account_connections_last,
    not_connected: m.account_connections_failed,
    unlink_failed: m.account_connections_failed,
  };

  // svelte-ignore state_referenced_locally
  const disconnecting = actionForm({
    initial: { provider },
    schema: disconnectSchema,
    domain: 'account',
    onSuccess: () =>
      void goto(`${resolve('/account/profile')}?conta=desconectada`, { invalidateAll: true }),
    errorMessage: m.account_connections_failed,
  });
  const code = $derived(disconnecting.errors.provider?.[0]);
</script>

<Form action="?/disconnect" onsubmit={disconnecting.submit} class="grid justify-items-end gap-2">
  <input type="hidden" name="provider" value={provider} />
  <SubmitButton
    submitting={disconnecting.pending}
    delayed={disconnecting.delayed}
    timeout={disconnecting.timeout}
    class="btn h-12 rounded-lg border-2 border-surface-200-800 px-5 font-semibold hover:preset-tonal"
  >
    {m.account_connections_disconnect({ provider: label })}
  </SubmitButton>
  {#if code}
    <p role="alert" class="text-sm font-semibold text-error-700-300">
      {(errors[code] ?? m.account_connections_failed)()}
    </p>
  {/if}
</Form>
