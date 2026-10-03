<script lang="ts">
  import UserText from '$lib/components/UserText.svelte';
  // A destructive action that asks first (Remover da mesa…, Desativar mesa…, Suspender…): the dialog
  // says what will happen, focus starts on "Cancelar", Escape closes, and only the confirm button
  // acts. A bottom sheet on a phone. It opens from anywhere (a menu item, a button): the caller
  // owns `open`.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { FormMessage } from '$lib/forms/message';
  import { m } from '$lib/paraglide/messages';
  import ActionForm from './ActionForm.svelte';

  type Props = {
    open: boolean;
    title: string;
    text: string;
    /** The confirm button's words. */
    label: string;
    /** The SvelteKit action to post: `?/remove`, or a table's address plus `?/disable`. */
    action: string;
    /** The player a seat action is about; none for a table action. */
    playerId?: string;
    next?: string;
    username?: string | null;
    /** Shown as a toast when the action went through. */
    success?: string;
    onfail?: (message: FormMessage) => void;
  };

  let {
    open = $bindable(),
    title,
    text,
    label,
    action,
    playerId,
    next = '',
    username,
    success,
    onfail,
  }: Props = $props();

  // Focus starts on "Cancelar": the safe answer.
  const cancel = () => document.querySelector<HTMLElement>('[data-confirm-cancel]');
</script>

<Dialog
  {open}
  onOpenChange={(details) => (open = details.open)}
  role="alertdialog"
  initialFocusEl={cancel}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
    <Dialog.Positioner
      class="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4"
    >
      <Dialog.Content
        class="w-full max-w-md card rounded-b-none border border-surface-200-800 bg-surface-50-950 p-6 pb-8 shadow-2xl md:rounded-b-lg md:pb-6"
      >
        <Dialog.Title class="text-xl font-semibold"
          ><UserText text={title} {username} /></Dialog.Title
        >
        <Dialog.Description class="mt-2 text-surface-700-300">{text}</Dialog.Description>
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <Dialog.CloseTrigger
            data-confirm-cancel=""
            class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
            >{m.confirm_cancel()}</Dialog.CloseTrigger
          >
          <ActionForm
            {action}
            {playerId}
            {next}
            {label}
            buttonClass="btn h-12 rounded-lg preset-filled-error-500 px-4 font-semibold"
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
