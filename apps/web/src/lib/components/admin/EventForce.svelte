<script lang="ts">
  import { forceSchema } from '#lib/admin/event-filters.js';
  import PostButton from '#lib/components/PostButton.svelte';
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
</script>

<PostButton
  action="?/force"
  fields={{ id }}
  schema={forceSchema}
  errorMessage={m.admin_dialog_error}
  onResult={(result) => {
    if (result.type === 'success') {
      const outcome = (result.data as { outcome?: keyof typeof outcomes } | undefined)?.outcome;
      if (outcome) outcomes[outcome]();
    }
  }}
  error={(errors) => (errors._errors?.[0] || errors.id?.[0] ? m.admin_dialog_error() : undefined)}
  buttonClass="btn h-11 rounded-lg preset-tonal-primary px-4 font-semibold"
  ><span aria-hidden="true">{m.admin_events_force()}</span>
  <span class="sr-only">{m.admin_events_force_for({ type })}</span></PostButton
>
