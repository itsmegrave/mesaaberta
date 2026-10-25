<script lang="ts">
  import Button from '#lib/components/Button.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { forceSchema } from '#lib/admin/event-filters.js';
  import Form from '#lib/components/Form.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  /** "Rodar agora" for one event: runs it at once and says how it went. */
  let { id, type }: { id: string; type: string } = $props();

  const outcomes = {
    processed: () => toast.success(m.admin_events_forced_processed()),
    failed: () => toast.error(m.admin_events_forced_failed()),
    running: () => toast.error(m.admin_events_forced_running()),
    already_processed: () => toast.error(m.admin_events_forced_done()),
    not_found: () => toast.error(m.admin_events_forced_missing()),
  } as const;

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { id },
    schema: forceSchema,
    errorMessage: m.admin_dialog_error,
    onResult(result) {
      if (result.type === 'success') {
        const outcome = (result.data as { outcome?: keyof typeof outcomes } | undefined)?.outcome;
        if (outcome) outcomes[outcome]();
      }
    },
    onSuccess: () => {},
  });
</script>

<Form action="?/force" onsubmit={form.submit}>
  <input type="hidden" name="id" value={id} />
  <Button
    type="submit"
    size="custom"
    submitting={form.pending}
    delayed={form.delayed}
    timeout={form.timeout}
    class="btn h-11 rounded-lg preset-tonal-primary px-4 font-semibold"
    ><span aria-hidden="true">{m.admin_events_force()}</span>
    <span class="sr-only">{m.admin_events_force_for({ type })}</span></Button
  >
  {#if form.errors._errors?.[0] || form.errors.id?.[0]}
    <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {m.admin_dialog_error()}
    </p>
  {/if}
</Form>
