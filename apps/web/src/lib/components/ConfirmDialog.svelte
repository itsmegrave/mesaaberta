<script lang="ts">
  import UserText from '#lib/components/UserText.svelte';
  // A destructive action that asks first (Remover da mesa…, Desativar mesa…, Suspender…): the dialog
  // says what will happen, focus starts on "Cancelar", Escape closes, and only the confirm button
  // acts. A bottom sheet on a phone. It opens from anywhere (a menu item, a button): the caller
  // owns `open`.
  import { buttonClass } from '#lib/components/Button.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import type { FormMessage } from '#lib/forms/message.js';
  import { m } from '#lib/paraglide/messages.js';
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
    title: titleText,
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

<DialogShell
  bind:open
  role="alertdialog"
  sheet
  lazy={false}
  initialFocusEl={cancel}
  description={text}
>
  {#snippet title()}<UserText text={titleText} {username} />{/snippet}
  <DialogActions
    class="mt-6"
    cancel={m.confirm_cancel()}
    cancelAttributes={{ 'data-confirm-cancel': '' }}
  >
    {#snippet confirmButton()}
      <ActionForm
        {action}
        {playerId}
        {next}
        {label}
        buttonClass="{buttonClass('danger', 'md')} font-semibold"
        {success}
        onsuccess={() => (open = false)}
        onfail={(message) => {
          open = false;
          onfail?.(message);
        }}
      />
    {/snippet}
  </DialogActions>
</DialogShell>
