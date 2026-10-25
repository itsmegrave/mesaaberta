<script lang="ts">
  import type { Snippet } from 'svelte';
  import ErrorSummary from '#lib/components/ui/ErrorSummary.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormBanner from '#lib/components/ui/FormBanner.svelte';
  import type { Problem } from '#lib/forms/field-errors.js';
  import { m } from '#lib/paraglide/messages.js';

  // The form that makes or edits a thing shown as a card (a table, a partner, a campaign): the
  // fields in two columns' worth of sections, and beside them (below them on a phone) the card as it
  // will look. It posts as multipart, so an image travels with it without JavaScript.
  let {
    action,
    controller,
    problems,
    banner,
    cancelHref,
    note,
    previewTitleId = 'preview-title',
    children,
    actions,
    preview,
    details,
  }: {
    action?: string;
    controller: { submit: (event: SubmitEvent) => void; blur: (event: FocusEvent) => void };
    /** Each invalid field, for the summary at the top. */
    problems: Problem[];
    /** A problem with the whole form, above the fields. */
    banner?: string | null;
    /** Where "Cancelar" goes. */
    cancelHref: string;
    /** A line under the buttons. */
    note?: string;
    previewTitleId?: string;
    /** The sections. */
    children: Snippet;
    /** The submit buttons, before "Cancelar". */
    actions: Snippet;
    /** The card, kept out of the tab order and the reading order. */
    preview: Snippet;
    /** Under the card: what the card does not show. */
    details?: Snippet;
  } = $props();
</script>

<MAForm
  {action}
  enctype="multipart/form-data"
  onsubmit={controller.submit}
  onfocusout={controller.blur}
  class="mt-8 grid gap-8 lg:grid-cols-3 lg:gap-12"
>
  <div class="grid gap-8 lg:col-span-2">
    <ErrorSummary errors={problems} />
    <FormBanner text={banner} />
    {@render children()}
    <div class="flex flex-wrap items-center gap-5">
      {@render actions()}
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a canonical href -->
      <a href={cancelHref} class="link-underline font-semibold text-link">{m.form_cancel()}</a>
    </div>
    {#if note}<p class="text-sm text-muted">{note}</p>{/if}
  </div>
  <aside aria-labelledby={previewTitleId} class="lg:sticky lg:top-6 lg:self-start">
    <p id={previewTitleId} class="text-sm font-bold tracking-wider text-muted uppercase">
      {m.form_preview()}
    </p>
    <!-- A preview, not a link: `inert` keeps its card out of the tab order and the reading order. -->
    <div class="mt-3" inert>
      {@render preview()}
    </div>
    {@render details?.()}
  </aside>
</MAForm>
