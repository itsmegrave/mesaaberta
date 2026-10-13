<script lang="ts">
  import type { Snippet } from 'svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { notificationActionSchema } from '$lib/notifications/actions';
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages';

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

  // Each button owns its pending state; the feed and bell reload through the action redirect.
  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { ...(id ? { id } : {}), next },
    schema: notificationActionSchema,
    onSuccess: () => {},
    errorMessage: m.error_generic_text,
  });
</script>

<Form
  action="{localizedHref('/notifications', getLocale())}?/{action}"
  onsubmit={form.submit}
  class={className}
>
  {#if id}<input type="hidden" name="id" value={id} />{/if}
  <input type="hidden" name="next" value={next} />
  <SubmitButton
    submitting={form.pending}
    delayed={form.delayed}
    timeout={form.timeout}
    class={buttonClass}>{@render children()}</SubmitButton
  >
  {#if Object.keys(form.errors).length}
    <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {m.error_generic_text()}
    </p>
  {/if}
</Form>
