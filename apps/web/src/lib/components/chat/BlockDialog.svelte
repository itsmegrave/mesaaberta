<script lang="ts">
  // "Bloquear @pessoa…" (`use_message_safety`): says what a block does, focus starts on
  // "Cancelar", and only "Bloquear" posts. A bottom sheet on a phone.
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import PostButton from '#lib/components/PostButton.svelte';
  import { blockSchema } from '@mesaaberta/core/messages/schema';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';

  let {
    conversationId,
    person,
    open = $bindable(false),
    refresh = true,
    onblocked,
  }: {
    conversationId: string;
    person: { id: string; username: string | null };
    open?: boolean;
    /** False in the drawer, whose thread is not the page's data. */
    refresh?: boolean;
    onblocked?: () => void;
  } = $props();

  const name = $derived(atHandle(person.username));
  const cancel = () => document.querySelector<HTMLElement>('[data-block-cancel]');
</script>

<DialogShell
  bind:open
  role="alertdialog"
  sheet
  lazy={false}
  initialFocusEl={cancel}
  title={m.messages_block_title({ name })}
>
  <ul class="mt-3 grid list-disc gap-1 pl-5">
    <li>{m.messages_block_effect_contact()}</li>
    <li>{m.messages_block_effect_inbox()}</li>
    <li>{m.messages_block_effect_tables()}</li>
    <li>{m.messages_block_effect_silent()}</li>
  </ul>
  <p class="mt-3 text-surface-700-300">{m.messages_block_undo()}</p>
  <DialogActions
    class="mt-6"
    cancel={m.confirm_cancel()}
    cancelAttributes={{ 'data-block-cancel': '' }}
  >
    {#snippet confirmButton()}
      <PostButton
        action="/m/{conversationId}?/block"
        fields={{ profileId: person.id, blocked: 'true' }}
        schema={blockSchema}
        domain="account"
        {refresh}
        errorMessage={m.messages_block_failed}
        success={m.messages_blocked_toast({ name })}
        onSuccess={() => {
          open = false;
          onblocked?.();
        }}
        buttonClass="{buttonClass('danger', 'md')} font-semibold"
      >
        {m.messages_block_confirm()}
      </PostButton>
    {/snippet}
  </DialogActions>
</DialogShell>
