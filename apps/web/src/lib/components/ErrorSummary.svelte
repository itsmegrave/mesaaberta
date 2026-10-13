<script lang="ts">
  import { m } from '$lib/paraglide/messages';

  /**
   * At the top of a form after a failed submit: how many fields need attention, each with a link
   * that moves focus to it. The form also focuses the first invalid field itself; this is for the
   * reader who wants the whole list.
   */
  let {
    errors,
    class: className = '',
  }: {
    /** Each invalid field: the id of its control, its label, and what is wrong. */
    errors: { id: string; label: string; message: string }[];
    class?: string;
  } = $props();

  // A link to a field focuses it (a rich-text field or a picker has no single element to anchor to,
  // so the link looks for the control by id, then by the first thing inside it).
  function focusField(event: MouseEvent, id: string) {
    event.preventDefault();
    const target = document.getElementById(id);
    const focusable = target?.matches('input, select, textarea, button, [tabindex]')
      ? target
      : target?.querySelector<HTMLElement>('input, select, textarea, button, [contenteditable]');
    (focusable ?? target)?.focus();
  }
</script>

{#if errors.length > 0}
  <div role="alert" class="rounded-lg border-2 border-error-500 bg-error-500/10 p-4 {className}">
    <p class="font-semibold text-error-700-300">{m.form_summary_title({ count: errors.length })}</p>
    <ul class="mt-2 grid gap-1 text-sm">
      {#each errors as error (error.id)}
        <li>
          <a
            href="#{error.id}"
            onclick={(event) => focusField(event, error.id)}
            class="inline-flex min-h-11 items-center link-underline font-semibold"
            >{error.label}: {error.message}</a
          >
        </li>
      {/each}
    </ul>
  </div>
{/if}
