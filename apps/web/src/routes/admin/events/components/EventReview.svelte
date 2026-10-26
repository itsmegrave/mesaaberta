<script lang="ts">
  import { EVENT_REVIEWS, reviewSchema, type EventReview } from '#lib/admin/event-filters.js';
  import PostButton from '#lib/components/PostButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  /**
   * An admin's word on a given-up event: "Visto", "Ignorar" or "Corrigido". The one already given
   * is pressed; the line above the buttons says who gave it and when.
   */
  let { id, type, current }: { id: string; type: string; current: EventReview | null } = $props();

  const label = (review: EventReview) =>
    ({
      seen: m.admin_events_review_seen,
      ignored: m.admin_events_review_ignored,
      fixed: m.admin_events_review_fixed,
    })[review]();
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label={m.admin_events_review_for({ type })}>
  {#each EVENT_REVIEWS as review (review)}
    <PostButton
      action="?/review"
      fields={{ id, review }}
      schema={reviewSchema}
      errorMessage={m.admin_dialog_error}
      onResult={(result) => {
        if (result.type !== 'success') return;
        const outcome = (result.data as { outcome?: string } | undefined)?.outcome;
        if (outcome === 'not_failed') toast.error(m.admin_events_review_gone());
      }}
      error={(errors) =>
        errors._errors?.[0] || errors.id?.[0] || errors.review?.[0]
          ? m.admin_dialog_error()
          : undefined}
      buttonClass="btn h-11 rounded-lg px-4 font-semibold {current === review
        ? 'preset-filled-primary-500'
        : 'preset-tonal'}"
      ><span aria-pressed={current === review}>{label(review)}</span></PostButton
    >
  {/each}
</div>
