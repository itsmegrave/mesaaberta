<script lang="ts">
  import type { Snippet } from 'svelte';
  import { defaults, superForm } from 'sveltekit-superforms';
  import { zod4 } from 'sveltekit-superforms/adapters';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { notificationActionSchema } from '$lib/notifications/actions';
  import { getLocale } from '$lib/paraglide/runtime';

  type Props = {
    action: 'open' | 'read' | 'readAll';
    /** The notification; none for read all. */
    id?: string;
    /** Where to come back to: the page the form is on. */
    next: string;
    class?: string;
    buttonClass?: string;
    /** The button's content. */
    children: Snippet;
  };

  let { action, id, next, class: className = 'm-0', buttonClass = '', children }: Props = $props();

  // A button-only form on the feed's actions, which always answer with a redirect. Each needs its
  // own id: the bell and the page can both show the same notification.
  // svelte-ignore state_referenced_locally
  const { enhance, submitting, delayed, timeout } = superForm(
    defaults({ id, next }, zod4(notificationActionSchema)),
    { id: `notification:${action}:${id ?? ''}`, resetForm: false, invalidateAll: 'pessimistic' },
  );
</script>

<form
  method="POST"
  action="{localizedHref('/notifications', getLocale())}?/{action}"
  use:enhance
  class={className}
>
  {#if id}<input type="hidden" name="id" value={id} />{/if}
  <input type="hidden" name="next" value={next} />
  <SubmitButton submitting={$submitting} delayed={$delayed} timeout={$timeout} class={buttonClass}
    >{@render children()}</SubmitButton
  >
</form>
