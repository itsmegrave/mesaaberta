<script lang="ts">
  // Shown to the GM (or an admin) while a table is a draft: says nobody else sees it, and publishes it.
  import { actionForm } from '$lib/forms/action-form.svelte';
  import Form from '$lib/components/Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { answerSchema } from '$lib/tables/confirmation';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    action,
    next,
    waiting = null,
  }: {
    /** The manage page's `?/publish` action, as a resolved address. */
    action: string;
    /** Where a browser without JavaScript lands after publishing. */
    next: string;
    /** The table's system when it is a suggestion: it cannot be published until that is settled. */
    waiting?: { name: string; status: 'pending' | 'rejected' } | null;
  } = $props();

  // svelte-ignore state_referenced_locally
  const publish = actionForm({
    initial: { next },
    schema: answerSchema,
    domain: 'table',
    errorMessage: m.draft_publish_error,
    onSuccess: () => toast.success(m.toast_table_published()),
  });

  const error = $derived(
    publish.errors._errors?.[0] === 'in_the_past'
      ? m.draft_publish_in_the_past()
      : publish.errors._errors?.[0] === 'system_pending' ||
          publish.errors._errors?.[0] === 'system_rejected'
        ? m.draft_publish_system_waiting()
        : publish.errors._errors?.[0],
  );
</script>

<section
  aria-labelledby="draft-notice"
  class="mt-8 rounded-lg border-2 border-primary-500 bg-panel p-5 md:p-6"
>
  <h2 id="draft-notice" class="text-xl font-semibold">{m.draft_title()}</h2>
  {#if waiting?.status === 'pending'}
    <p class="mt-2 text-surface-700-300">{m.draft_system_pending({ name: waiting.name })}</p>
  {:else if waiting?.status === 'rejected'}
    <p class="mt-2 text-surface-700-300">{m.draft_system_rejected({ name: waiting.name })}</p>
  {:else}
    <p class="mt-2 text-surface-700-300">{m.draft_text()}</p>

    <Form {action} onsubmit={publish.submit} class="m-0 mt-5">
      <input type="hidden" name="next" value={next} />
      <SubmitButton
        submitting={publish.pending}
        delayed={publish.delayed}
        timeout={publish.timeout}
        class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
        >{m.draft_publish()}</SubmitButton
      >
      {#if error}
        <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">{error}</p>
      {/if}
    </Form>
  {/if}
</section>
