<script lang="ts">
  // "Entrar com passkey": the browser offers the passkeys it holds for this site, and the server
  // asks Supabase to check the one chosen. No e-mail is typed first.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import PasskeyProblem from '#lib/components/ui/PasskeyProblem.svelte';
  import { passkeyCeremony } from '#lib/auth/passkey-ceremony.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  let { next }: { next: string } = $props();

  // svelte-ignore state_referenced_locally
  const ceremony = passkeyCeremony('sign-in', {
    options: '?/passkeyOptions',
    answer: '?/passkey',
    fields: { next },
  });
</script>

<div class="grid gap-2">
  <MAButton
    variant="ghost"
    class="w-full justify-center border-2 border-surface-200-800 bg-panel font-semibold hover:preset-tonal"
    submitting={ceremony.pending}
    aria-describedby="passkey-problem"
    onclick={() => ceremony.start()}
  >
    {m.passkey_sign_in()}
  </MAButton>
  <PasskeyProblem id="passkey-problem" problem={ceremony.problem} />
</div>
