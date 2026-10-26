<script lang="ts">
  // "Pedir vaga" on a table that approves each player: a modal with an optional note, so the player
  // can introduce themselves to the GM. The server checks everything again.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { JOIN_MESSAGE_MAX, joinSchema } from '#lib/tables/registration.js';
  import { registrationError } from '#lib/tables/registration-errors.js';
  import type { FormMessage } from '#lib/forms/message.js';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  let {
    action = '?/join',
    triggerClass = '',
    onfail,
  }: {
    action?: string;
    triggerClass?: string;
    /** Runs when the server refused, after the error is shown as a toast. */
    onfail?: (message: FormMessage) => void;
  } = $props();

  let open = $state(false);
  const form = actionForm({
    initial: { message: '' },
    schema: joinSchema,
    domain: 'table',
    errorMessage: () => registrationError('invalid'),
    onSuccess() {
      open = false;
      form.reset();
      toast.pending(m.toast_pending());
    },
    onFailure(updated) {
      const message = updated?.message ?? { code: 'invalid' };
      // A full table or a repeat request is about the table, not the note: leave the dialog.
      if (message.code !== 'invalid') open = false;
      toast.error(registrationError(message.code, message.retryAfter));
      onfail?.(message);
    },
  });
  const data = $derived(form.values);
  const messageError = $derived(
    form.errors.message?.[0] ? m.join_request_err_message({ max: JOIN_MESSAGE_MAX }) : undefined,
  );
</script>

<DialogShell
  bind:open
  size="lg"
  scroll
  {triggerClass}
  title={m.join_request_title()}
  description={m.join_request_lede()}
>
  {#snippet trigger()}
    <Icon name="game-icons:bar-stool" size={20} />
    {m.table_join_request()}
  {/snippet}
  <MAForm {action} onsubmit={form.submit} class="mt-4 grid gap-4">
    <FormField
      id="join-message"
      label={m.join_request_message()}
      hint={m.join_request_message_hint()}
      error={messageError}
      optional
      counter={{ count: data.message.length, max: JOIN_MESSAGE_MAX, remaining: true }}
    >
      {#snippet children(aria)}
        <MATextArea
          id="join-message"
          name="message"
          rows={5}
          maxlength={JOIN_MESSAGE_MAX}
          class="textarea rounded-lg border-control border-ink-muted bg-panel p-3"
          value={data.message}
          oninput={(event) => form.change('message', event.currentTarget.value)}
          {...aria}
        ></MATextArea>
      {/snippet}
    </FormField>

    <DialogActions
      cancel={m.admin_dialog_cancel()}
      controller={form}
      confirm={m.join_request_submit()}
    />
  </MAForm>
</DialogShell>
