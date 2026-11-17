<script lang="ts">
  // The line under a passkey button saying why it did not go through. Closing the prompt says nothing.
  import type { PasskeyProblem } from '#lib/auth/passkey-ceremony.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  let { problem, id }: { problem: PasskeyProblem | null; id?: string } = $props();

  const words: Record<Exclude<PasskeyProblem, 'cancelled'>, () => string> = {
    unsupported: m.passkey_problem_unsupported,
    refused: m.passkey_problem_refused,
    exists: m.passkey_problem_exists,
    unavailable: m.passkey_problem_unavailable,
  };
  const text = $derived(problem && problem !== 'cancelled' ? words[problem]() : '');
</script>

<p {id} role="status" class="text-sm font-semibold text-error-700-300 empty:hidden">{text}</p>
