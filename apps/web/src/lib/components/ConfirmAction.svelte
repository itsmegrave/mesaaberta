<script lang="ts">
  // A seat or table action with its own button (Remover, Recusar): the button opens a
  // `ConfirmDialog`, and only its confirm button posts.
  import type { FormMessage } from '#lib/forms/message.js';
  import ConfirmDialog from './ui/ConfirmDialog.svelte';
  import MAButton from './ui/MAButton.svelte';

  type Props = {
    action: string;
    /** The player a seat action is about; none for a table action (Desativar mesa). */
    playerId?: string;
    next?: string;
    /** The button's text, and the confirm button's. */
    label: string;
    title: string;
    username?: string | null;
    text: string;
    class?: string;
    /** Shown as a toast when the action went through. */
    success?: string;
    onfail?: (message: FormMessage) => void;
  };

  let { class: buttonClass = '', label, ...dialog }: Props = $props();

  let open = $state(false);
</script>

<MAButton size="custom" type="button" class={buttonClass} onclick={() => (open = true)}>
  {label}
</MAButton>
<ConfirmDialog bind:open {label} {...dialog} />
