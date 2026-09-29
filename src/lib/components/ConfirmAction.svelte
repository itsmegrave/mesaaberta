<script lang="ts">
  // A seat action that asks first (Remover, Recusar): the button opens a dialog that says what will
  // happen, and only its confirm button posts. Until JavaScript runs there is no dialog, so the
  // button posts straight away, as it did before.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import type { FormMessage } from '$lib/forms/message';
  import { m } from '$lib/paraglide/messages';
  import ActionForm from './ActionForm.svelte';

  type Props = {
    action: string;
    playerId: string;
    next?: string;
    /** The button's text, and the confirm button's. */
    label: string;
    title: string;
    text: string;
    class?: string;
    /** Shown as a toast when the action went through. */
    success?: string;
    onfail?: (message: FormMessage) => void;
  };

  let {
    action,
    playerId,
    next = '',
    label,
    title,
    text,
    class: buttonClass = '',
    success,
    onfail,
  }: Props = $props();

  let mounted = $state(false);
  onMount(() => (mounted = true));
  let open = $state(false);
</script>

{#if mounted}
  <Dialog {open} onOpenChange={(details) => (open = details.open)} role="alertdialog">
    <Dialog.Trigger class={buttonClass}>{label}</Dialog.Trigger>
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="w-full max-w-md card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description class="mt-2 text-surface-700-300">{text}</Dialog.Description>
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.CloseTrigger
              class="btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
              >{m.confirm_cancel()}</Dialog.CloseTrigger
            >
            <ActionForm
              {action}
              {playerId}
              {next}
              {label}
              buttonClass="btn h-11 rounded-lg preset-filled-error-500 px-4 font-semibold"
              {success}
              onsuccess={() => (open = false)}
              onfail={(message) => {
                open = false;
                onfail?.(message);
              }}
            />
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog>
{:else}
  <ActionForm {action} {playerId} {next} {label} {buttonClass} {success} {onfail} />
{/if}
