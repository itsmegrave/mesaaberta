<script lang="ts">
  // "Passkeys" in Conta e acesso: the account's passkeys (Supabase keeps them), adding one with the
  // browser's passkey prompt and removing one. Only the signed-in person sees this.
  import { page } from '$app/state';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import PasskeyProblem from '#lib/components/ui/PasskeyProblem.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import { shortDate } from '#lib/admin/format.js';
  import { passkeyCeremony } from '#lib/auth/passkey-ceremony.svelte.js';
  import { passkeyRemoveSchema } from '#lib/auth/passkey.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { m } from '#lib/paraglide/messages.js';
  import type { PasskeySummary } from '@mesaaberta/core/server/auth/passkeys';

  let { passkeys, class: className = '' }: { passkeys: PasskeySummary[] | null; class?: string } =
    $props();

  const ceremony = passkeyCeremony('register', {
    options: '?/passkeyRegisterOptions',
    answer: '?/passkeyRegister',
  });

  const locale = getLocale();
  // Server and browser write the same day: the platform's zone, not the browser's.
  const day = (iso: string) => shortDate(new Date(iso), locale, 'America/Sao_Paulo');

  const notices: Record<string, () => string> = {
    adicionada: m.account_passkeys_added,
    removida: m.account_passkeys_removed,
  };
  const notice = $derived(notices[page.url.searchParams.get('passkey') ?? '']?.());
</script>

<section aria-labelledby="passkeys" class={className}>
  <h2 id="passkeys" class="text-2xl leading-tight font-semibold tracking-tight">
    {m.account_passkeys_title()}
  </h2>
  <p class="mt-3 max-w-prose text-muted">{m.account_passkeys_text()}</p>

  {#if notice}
    <p role="status" class="mt-3 text-sm font-semibold">{notice}</p>
  {/if}

  {#if passkeys === null}
    <p class="mt-5 text-sm text-muted">{m.account_passkeys_unavailable()}</p>
  {:else if passkeys.length === 0}
    <p class="mt-5 text-sm text-muted">{m.account_passkeys_empty()}</p>
  {:else}
    <ul class="mt-5 grid gap-3">
      {#each passkeys as passkey (passkey.id)}
        {@const name = passkey.name ?? m.account_passkeys_unnamed()}
        <li
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface-200-800 p-3"
        >
          <span class="grid gap-1">
            <span class="font-semibold">{name}</span>
            <span class="text-sm text-muted">
              {passkey.lastUsedAt
                ? m.account_passkeys_last_used({ date: day(passkey.lastUsedAt) })
                : m.account_passkeys_created({ date: day(passkey.createdAt) })}
            </span>
          </span>
          <PostButton
            action="?/passkeyRemove"
            fields={{ passkeyId: passkey.id }}
            schema={passkeyRemoveSchema}
            domain="account"
            errorMessage={m.account_passkeys_remove_failed}
            error={(refused) =>
              refused.passkeyId ? m.account_passkeys_remove_failed() : undefined}
            errorClass=""
            class="grid justify-items-end gap-2"
            buttonClass="btn h-11 rounded-lg btn-secondary px-5 font-semibold"
          >
            <span aria-hidden="true">{m.account_passkeys_remove()}</span>
            <span class="sr-only">{m.account_passkeys_remove_label({ name })}</span>
          </PostButton>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="mt-5 grid justify-items-start gap-2">
    <MAButton
      variant="ghost"
      class="border-2 border-primary-500 px-5 font-semibold"
      submitting={ceremony.pending}
      aria-describedby="passkey-add-problem"
      onclick={() => ceremony.start()}
    >
      {m.account_passkeys_add()}
    </MAButton>
    <PasskeyProblem id="passkey-add-problem" problem={ceremony.problem} />
  </div>
</section>
