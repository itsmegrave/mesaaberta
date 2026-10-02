<script lang="ts">
  import type { Snippet } from 'svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from './Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import type { FormMessage } from '$lib/forms/message';
  import { actionSchema } from '$lib/tables/registration';
  import { registrationError } from '$lib/tables/registration-errors';
  import { toast } from '$lib/toaster';

  type Props = {
    /** Where to post: `?/leave` on the table's own page, or the table's address plus `?/leave` from elsewhere. */
    action: string;
    playerId?: string;
    next?: string;
    class?: string;
    /** The button's text. With it, the form draws its own `SubmitButton`, busy while it posts. */
    label?: string;
    buttonClass?: string;
    /** Shown as a toast when the action went through. */
    success?: string;
    /** Runs when the action went through (the server answered with a redirect back to the page). */
    onsuccess?: () => void;
    /** Runs when the server refused, after the error is shown as a toast. */
    onfail?: (message: FormMessage) => void;
    /** Custom content instead of `label` (a button of its own must be `type="submit"`). */
    children?: Snippet;
  };

  let {
    action,
    playerId,
    next = '',
    class: className = '',
    label,
    buttonClass = '',
    success,
    onsuccess,
    onfail,
    children,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { playerId, next },
    schema: actionSchema,
    domain: action.includes('Photo') ? 'account' : 'table',
    errorMessage: () => registrationError('invalid'),
    onSuccess() {
      if (success) toast.success(success);
      onsuccess?.();
    },
    onFailure(updated) {
      const message = updated?.message ?? { code: 'invalid' };
      toast.error(registrationError(message.code, message.retryAfter));
      onfail?.(message);
    },
  });
</script>

<Form {action} onsubmit={form.submit} class={className}>
  {#if playerId}<input type="hidden" name="playerId" value={playerId} />{/if}
  {#if next}<input type="hidden" name="next" value={next} />{/if}
  {#if label}
    <SubmitButton
      submitting={form.pending}
      delayed={form.delayed}
      timeout={form.timeout}
      class={buttonClass}>{label}</SubmitButton
    >
  {:else}
    {@render children?.()}
  {/if}
</Form>
