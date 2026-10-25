<script lang="ts">
  import { retryAllSchema } from '#lib/admin/event-filters.js';
  import PostButton from '#lib/components/PostButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  /** "Rodar todos os que falharam": a bounded batch, oldest first. */
  let { max }: { max: number } = $props();
</script>

<PostButton
  action="?/retryAll"
  schema={retryAllSchema}
  errorMessage={m.admin_dialog_error}
  onResult={(result) => {
    if (result.type !== 'success') return;
    const data = result.data as
      { tried?: number; processed?: number; remaining?: number } | undefined;
    if (!data || data.tried === undefined) return;
    if (data.tried === 0) return void toast.success(m.admin_events_retry_all_none());
    const done = m.admin_events_retry_all_done({
      processed: data.processed ?? 0,
      tried: data.tried,
    });
    if (data.remaining)
      toast.error(`${done} ${m.admin_events_retry_all_left({ remaining: data.remaining })}`);
    else toast.success(done);
  }}
  error={(errors) => (errors._errors?.[0] ? m.admin_dialog_error() : undefined)}
  errorClass=""
  class="flex flex-wrap items-center gap-3"
  buttonClass="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
  >{m.admin_events_retry_all()}
  {#snippet after()}
    <p class="text-sm text-muted">{m.admin_events_retry_all_hint({ max })}</p>
  {/snippet}
</PostButton>
