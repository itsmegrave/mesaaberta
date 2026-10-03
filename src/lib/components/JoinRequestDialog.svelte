<script lang="ts">
  // "Pedir vaga" on a table that approves each player: a modal with an optional note, so the player
  // can introduce themselves to the GM. The server checks everything again.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { JOIN_MESSAGE_MAX, joinSchema } from '$lib/tables/registration';
  import { registrationError } from '$lib/tables/registration-errors';
  import type { FormMessage } from '$lib/forms/message';
  import Form from '$lib/components/Form.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import TextArea from '$lib/components/TextArea.svelte';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

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

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
  }}
>
  <Dialog.Trigger class={triggerClass}>
    <Icon name="game-icons:bar-stool" size={20} />
    {m.table_join_request()}
  </Dialog.Trigger>
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="max-h-full w-full max-w-lg overflow-y-auto card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold">{m.join_request_title()}</Dialog.Title>
          <Dialog.Description class="mt-2 text-surface-700-300"
            >{m.join_request_lede()}</Dialog.Description
          >
          <Form {action} onsubmit={form.submit} class="mt-4 grid gap-4">
            <FormField
              id="join-message"
              label={m.join_request_message()}
              hint={m.join_request_message_hint()}
              error={messageError}
              optional
              counter={{ count: data.message.length, max: JOIN_MESSAGE_MAX, remaining: true }}
            >
              {#snippet children(aria)}
                <TextArea
                  id="join-message"
                  name="message"
                  rows={5}
                  maxlength={JOIN_MESSAGE_MAX}
                  class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
                  value={data.message}
                  oninput={(event) => form.change('message', event.currentTarget.value)}
                  {...aria}
                ></TextArea>
              {/snippet}
            </FormField>

            <div class="mt-2 flex flex-wrap justify-end gap-3">
              <Dialog.CloseTrigger
                class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
                >{m.admin_dialog_cancel()}</Dialog.CloseTrigger
              >
              <SubmitButton
                submitting={form.pending}
                delayed={form.delayed}
                timeout={form.timeout}
                class="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
                >{m.join_request_submit()}</SubmitButton
              >
            </div>
          </Form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  {/if}
</Dialog>
