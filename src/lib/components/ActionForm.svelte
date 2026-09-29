<script lang="ts">
  import type { Snippet } from 'svelte';
  import { defaults, superForm } from 'sveltekit-superforms';
  import { zod4 } from 'sveltekit-superforms/adapters';
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

  // A button-only form: the server validates, so the browser has nothing to check. Each form on a
  // page needs its own id (a row per player, a card per table). The page's data is reloaded only
  // when the action went through, so a refusal leaves what is on screen as it was.
  // svelte-ignore state_referenced_locally
  const { enhance, submitting, delayed, timeout } = superForm<
    { playerId?: string; next: string },
    FormMessage
  >(defaults({ playerId, next }, zod4(actionSchema)), {
    id: `${action}:${playerId ?? ''}`,
    resetForm: false,
    invalidateAll: 'pessimistic',
    onResult({ result }) {
      if (result.type !== 'redirect') return;
      if (success) toast.success(success);
      onsuccess?.();
    },
    onUpdated({ form }) {
      if (form.valid || !form.message) return;
      toast.error(registrationError(form.message.code, form.message.retryAfter));
      onfail?.(form.message);
    },
  });
</script>

<form method="POST" {action} use:enhance class={className}>
  {#if playerId}<input type="hidden" name="playerId" value={playerId} />{/if}
  {#if next}<input type="hidden" name="next" value={next} />{/if}
  {#if label}
    <SubmitButton submitting={$submitting} delayed={$delayed} timeout={$timeout} class={buttonClass}
      >{label}</SubmitButton
    >
  {:else}
    {@render children?.()}
  {/if}
</form>
