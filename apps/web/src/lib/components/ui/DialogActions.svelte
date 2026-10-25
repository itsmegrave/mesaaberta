<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog } from '@skeletonlabs/skeleton-svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';

  // A dialog's footer: the way out, then the answer. "Cancelar" is the dialog's close trigger, or a
  // plain button when `oncancel` decides what cancelling means (and outside a dialog). The answer is
  // the form's submit button (`controller`), a plain button (`onconfirm`) or the caller's own
  // (`confirmButton`, for a form of its own).
  let {
    cancel,
    oncancel,
    cancelAttributes = {},
    confirm = '',
    tone = 'primary',
    controller,
    onconfirm,
    disabled = false,
    confirmButton,
    before,
    class: className = 'mt-2',
  }: {
    cancel: string;
    oncancel?: () => void;
    /** Extra attributes on the cancel button (a marker that focus starts there). */
    cancelAttributes?: Record<string, string>;
    /** The answer's words. */
    confirm?: string;
    /** Red when the answer takes something away. */
    tone?: 'primary' | 'danger';
    controller?: { pending: boolean; delayed: boolean; timeout: boolean };
    onconfirm?: () => void;
    disabled?: boolean;
    confirmButton?: Snippet;
    /** Pushed to the start of the row: a third, lesser choice. */
    before?: Snippet;
    class?: string;
  } = $props();

  const cancelClass = `${buttonClass('secondary', 'md')} font-semibold`;
</script>

<div class="flex flex-wrap justify-end gap-3 {className}">
  {@render before?.()}
  {#if oncancel}
    <MAButton variant="secondary" class="font-semibold" {...cancelAttributes} onclick={oncancel}
      >{cancel}</MAButton
    >
  {:else}
    <Dialog.CloseTrigger {...cancelAttributes} class={cancelClass}>{cancel}</Dialog.CloseTrigger>
  {/if}
  {#if confirmButton}
    {@render confirmButton()}
  {:else if onconfirm}
    <MAButton
      variant={tone === 'danger' ? 'danger' : 'primary'}
      class="font-semibold"
      {disabled}
      onclick={onconfirm}>{confirm}</MAButton
    >
  {:else}
    <MAButton
      type="submit"
      variant={tone === 'danger' ? 'danger' : 'primary'}
      {controller}
      class="font-semibold">{confirm}</MAButton
    >
  {/if}
</div>
