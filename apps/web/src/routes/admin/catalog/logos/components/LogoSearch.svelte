<script lang="ts">
  // The logo search: each post looks at the next few systems on the server (see searchNextLogos),
  // and this repeats it until none is left or the admin stops it. What was searched stays recorded,
  // so a closed page or a failed step loses nothing: the next run goes on from there.
  import { refreshAll } from '$app/navigation';
  import { createMutation } from '@tanstack/svelte-query';
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { postAction } from '#lib/forms/action.js';
  import { queryClient } from '#lib/query/context.js';
  import { toast } from '#lib/toaster.js';
  import { m } from '#lib/paraglide/messages.js';

  let { unsearched }: { unsearched: number } = $props();

  /** The longest pause Wikimedia may ask for before the search waits for the admin instead. */
  const MAX_PAUSE_S = 120;
  let stopping = $state(false);
  let pausing = $state(0);
  let searched = $state(0);
  const client = queryClient();
  const run = createMutation(
    () => ({
      mutationFn: async () => {
        searched = 0;
        stopping = false;
        for (;;) {
          const result = await postAction('?/search', new FormData());
          if (result.type !== 'success') throw new Error('search_failed');
          const step = result.data as
            | { searched?: unknown[]; more?: boolean; failed?: boolean; retryAfter?: number }
            | undefined;
          searched += step?.searched?.length ?? 0;
          // Wikimedia asked for a pause: wait as long as it said, then go on (a long one stops).
          if (step?.failed && step.retryAfter && step.retryAfter <= MAX_PAUSE_S && !stopping) {
            pausing = step.retryAfter;
            await new Promise((done) => setTimeout(done, step.retryAfter! * 1000));
            pausing = 0;
            continue;
          }
          if (step?.failed) throw new Error('lookup_failed');
          if (!step?.more || stopping) return;
        }
      },
      onError: (error) =>
        toast.error(
          error.message === 'lookup_failed'
            ? m.admin_logos_lookup_failed()
            : m.admin_dialog_error(),
        ),
      onSettled: () => refreshAll(),
      retry: false,
    }),
    () => client,
  );
</script>

<section class="mt-6 rounded-lg border border-surface-200-800 p-4 md:p-6">
  {#if unsearched > 0 || run.isPending}
    <p class="font-semibold" role="status">
      {run.isPending
        ? pausing
          ? m.admin_logos_pausing({ count: searched, seconds: pausing })
          : m.admin_logos_searching({ count: searched })
        : m.admin_logos_unsearched({ count: unsearched })}
    </p>
    <p class="mt-1 text-sm text-muted">{m.admin_logos_search_hint()}</p>
    <div class="mt-4 flex flex-wrap gap-3">
      <MAButton
        variant="primary"
        submitting={run.isPending}
        onclick={() => {
          if (!run.isPending) run.mutate();
        }}>{m.admin_logos_search()}</MAButton
      >
      {#if run.isPending}
        <MAButton variant="secondary" onclick={() => (stopping = true)} aria-disabled={stopping}
          >{m.admin_logos_stop()}</MAButton
        >
      {/if}
    </div>
  {:else}
    <p role="status">{m.admin_logos_search_done()}</p>
  {/if}
</section>
