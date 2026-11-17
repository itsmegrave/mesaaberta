<script lang="ts">
  import { z } from 'zod';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { fromResult, initialForm } from '#lib/forms/contract.js';
  import AuthShell from '#lib/components/ui/AuthShell.svelte';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import { m } from '#lib/paraglide/messages.js';

  // The consent step of an MCP client (Claude) signing in: who asks, what it will see as the
  // person, that it changes nothing, and where the person goes back to. Approving or denying hands
  // the person back to the client; a request that no longer holds says so instead.
  let { data, form: result = null } = $props();
  const request = $derived(data.request);
  const schema = z.object({ authorizationId: z.string().min(1) });
  let expired = $state(false);

  // svelte-ignore state_referenced_locally
  const initial = fromResult(result?.form ?? data.form ?? initialForm({ authorizationId: '' }));
  // One controller per button: each posts to its own action and shows its own wait.
  const decision = () =>
    actionForm({
      ...initial,
      schema,
      onSuccess: () => {},
      onFailure: () => (expired = true),
      errorMessage: m.oauth_consent_expired,
    });
  const approve = decision();
  const deny = decision();
  const authorizationId = $derived(data.form?.data.authorizationId ?? '');
</script>

<svelte:head
  ><title>{m.oauth_consent_page_title()} · Mesa Aberta</title><meta
    name="robots"
    content="noindex"
  /></svelte:head
>

{#if request && !expired && !result?.form?.message}
  <AuthShell
    title={m.oauth_consent_title({ client: request.client })}
    lede={m.oauth_consent_lede({ client: request.client, username: request.username })}
  >
    <div class="grid gap-5">
      <div class="rounded-lg border border-surface-200-800 bg-panel p-5">
        <h2 class="font-semibold">{m.oauth_consent_reads_heading({ client: request.client })}</h2>
        <p class="mt-2">{m.oauth_consent_reads()}</p>
        <p class="mt-3 flex items-start gap-2 text-muted">
          <Icon name="lock" size={20} class="mt-0.5 shrink-0" />
          <span>{m.oauth_consent_no_writes({ client: request.client })}</span>
        </p>
      </div>
      {#if request.returnsTo}
        <p class="text-muted">{m.oauth_consent_returns({ host: request.returnsTo })}</p>
      {/if}
      <div class="flex flex-col gap-3 sm:flex-row">
        <MAForm action="?/approve" onsubmit={approve.submit}>
          <input type="hidden" name="authorizationId" value={authorizationId} />
          <MAButton type="submit" variant="primary" controller={approve} class="font-semibold"
            >{m.oauth_consent_approve()}</MAButton
          >
        </MAForm>
        <MAForm action="?/deny" onsubmit={deny.submit}>
          <input type="hidden" name="authorizationId" value={authorizationId} />
          <MAButton type="submit" variant="secondary" controller={deny} class="font-semibold"
            >{m.oauth_consent_deny()}</MAButton
          >
        </MAForm>
      </div>
    </div>
  </AuthShell>
{:else}
  <AuthShell title={m.oauth_consent_page_title()}>
    <p role="alert" class="rounded-lg border-2 border-error-alert bg-panel px-4 py-3 font-semibold">
      {m.oauth_consent_expired()}
    </p>
  </AuthShell>
{/if}
