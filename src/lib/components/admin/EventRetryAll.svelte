<script lang="ts">
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { retryAllSchema } from '$lib/admin/event-filters';
  import Form from '$lib/components/Form.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  /** "Rodar todos os que falharam": a bounded batch, oldest first. */
  let { max }: { max: number } = $props();

  const form = actionForm({
    initial: {},
    schema: retryAllSchema,
    errorMessage: m.admin_dialog_error,
    onResult(result) {
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
    },
    onSuccess: () => {},
  });
</script>

<Form action="?/retryAll" onsubmit={form.submit} class="flex flex-wrap items-center gap-3">
  <SubmitButton
    submitting={form.pending}
    delayed={form.delayed}
    timeout={form.timeout}
    class="btn h-11 rounded-lg preset-filled-primary-500 px-4 font-semibold"
    >{m.admin_events_retry_all()}</SubmitButton
  >
  <p class="text-sm text-muted">{m.admin_events_retry_all_hint({ max })}</p>
  {#if form.errors._errors?.[0]}
    <p role="alert" class="text-sm font-semibold text-error-700-300">{m.admin_dialog_error()}</p>
  {/if}
</Form>
