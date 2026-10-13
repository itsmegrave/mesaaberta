<script lang="ts">
  import TextArea from '$lib/components/TextArea.svelte';
  import { tick } from 'svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import type { FormResult } from '$lib/forms/contract';
  import Form from './Form.svelte';
  import EmojiPicker from '$lib/components/EmojiPicker.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { MESSAGE_MAX_LENGTH, messageSchema, type MessageInput } from '$lib/messages/schema';
  import { m } from '$lib/paraglide/messages';

  type Props = {
    form: FormResult<MessageInput>;
    action?: string;
    /** Called as a message goes out, with its text. Returns the id of the bubble that stands for it. */
    onpending: (body: string) => string;
    /** The server took it. */
    onsent: (id: string) => void | Promise<void>;
    /** The server refused it, or could not be reached. */
    onfailed: (id: string, code: string) => void;
  };

  let { form: initial, action = '?/send', onpending, onsent, onfailed }: Props = $props();

  // The bubble of the message on its way, and the one being sent again.
  let inFlight: string | null = null;
  let retrying: string | null = null;
  let savedDraft: string | null = null;
  let notice = $state<string | null>(null);
  let formEl: HTMLFormElement | undefined = $state();
  let textarea: HTMLTextAreaElement | undefined = $state();

  const reasons: Record<string, () => string> = {
    forbidden: m.messages_error_forbidden,
    direct_messages_off: m.messages_error_off,
    rate_limited: m.messages_error_rate_limited,
  };

  const failBubble = (code: string) => {
    const id = inFlight;
    inFlight = null;
    if (!id) return;
    notice = reasons[code]?.() ?? m.messages_error_generic();
    onfailed(id, code);
  };
  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    initial: initial.data,
    schema: messageSchema,
    errorMessage: m.messages_error_generic,
    onSuccess: () => {},
    onSending(data) {
      const body = String(data.get('body') ?? '').trim();
      notice = null;
      inFlight = retrying ?? onpending(body);
      retrying = null;
      if (savedDraft !== null) controller.change('body', savedDraft);
      else if (controller.values.body.trim() === body) controller.change('body', '');
      savedDraft = null;
    },
    async onResult(result) {
      if (result.type === 'success' || result.type === 'failure') {
        const updated = (result.data as { form?: FormResult<MessageInput> } | undefined)?.form;
        if (result.type === 'success' && updated?.valid && updated.message?.code === 'sent') {
          const id = inFlight;
          inFlight = null;
          if (id) await onsent(id);
        } else failBubble(updated?.message?.code ?? 'invalid');
        return true;
      }
      failBubble('network');
      return result.type !== 'redirect';
    },
    onError: () => failBubble('network'),
  });
  async function send(event: SubmitEvent) {
    if (!messageSchema.safeParse(controller.values).success) {
      event.preventDefault();
      retrying = null;
      if (savedDraft !== null) controller.change('body', savedDraft);
      savedDraft = null;
      return;
    }
    await controller.submit(event);
  }

  let selectionStart = 0;
  let selectionEnd = 0;
  const rememberSelection = () => {
    selectionStart = textarea?.selectionStart ?? controller.values.body.length;
    selectionEnd = textarea?.selectionEnd ?? selectionStart;
  };
  async function insertEmoji(emoji: string) {
    const start = Math.min(selectionStart, controller.values.body.length);
    const end = Math.min(selectionEnd, controller.values.body.length);
    const next = controller.values.body.slice(0, start) + emoji + controller.values.body.slice(end);
    if (next.length > MESSAGE_MAX_LENGTH) return;
    controller.change('body', next);
    await tick();
    textarea?.focus();
    textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    rememberSelection();
  }

  const remaining = $derived(MESSAGE_MAX_LENGTH - controller.values.body.length);
  const error = $derived(controller.errors.body?.[0]);

  const keydown = (event: KeyboardEvent) => {
    // Enter sends, Shift+Enter breaks the line, and a key that confirms an input method's text does neither.
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229)
      return;
    event.preventDefault();
    if (controller.values.body.trim()) formEl?.requestSubmit();
  };

  /** Sends a failed message again, keeping what is being typed in the box. */
  export async function retry(id: string, body: string) {
    if (inFlight || controller.pending) return;
    savedDraft = controller.values.body;
    retrying = id;
    controller.change('body', body);
    await tick();
    formEl?.requestSubmit();
  }

  export function focus() {
    textarea?.focus();
  }
</script>

<Form
  bind:element={formEl}
  {action}
  onsubmit={send}
  class="flex min-w-0 flex-col gap-2 border-t border-surface-200-800 pt-3"
>
  {#if controller.values.tableId}<input
      type="hidden"
      name="tableId"
      value={controller.values.tableId}
    />{/if}
  <div
    class="flex items-end gap-1 rounded-xl border border-surface-200-800 bg-panel p-1 focus-within:ring-2 focus-within:ring-primary-500"
  >
    <EmojiPicker onselect={insertEmoji} finalFocusEl={() => textarea ?? null} />
    <label for="message-body" class="sr-only">{m.messages_composer_label()}</label>
    <TextArea
      id="message-body"
      name="body"
      bind:element={textarea}
      bind:value={() => controller.values.body, (value) => controller.change('body', value)}
      onkeydown={keydown}
      onselect={rememberSelection}
      oninput={rememberSelection}
      onblur={rememberSelection}
      rows={1}
      maxlength={MESSAGE_MAX_LENGTH}
      placeholder={m.messages_composer_placeholder()}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error || notice ? 'message-notice' : undefined}
      class="textarea field-sizing-content max-h-40 min-h-12 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-2 py-3 shadow-none focus:outline-none"
    ></TextArea>
    <SubmitButton
      submitting={controller.pending}
      delayed={controller.delayed}
      timeout={controller.timeout}
      class="btn h-12 shrink-0 rounded-lg preset-filled-primary-500 px-4 font-semibold"
    >
      <Icon name="send" size={18} />
      <span class="hidden sm:inline">{m.messages_send()}</span>
      <span class="sr-only sm:hidden">{m.messages_send()}</span>
    </SubmitButton>
  </div>
  <div class="flex items-center justify-between gap-3 text-sm">
    <p id="message-notice" role="alert" class="font-semibold text-error-700-300">
      {#if error}
        {error === 'too_long' ? m.messages_error_too_long() : m.messages_error_required()}
      {:else if notice}
        {notice}
      {/if}
    </p>
    {#if remaining <= 200}
      <p class="ml-auto text-muted" aria-live="polite">
        {controller.values.body.length}/{MESSAGE_MAX_LENGTH}
      </p>
    {/if}
  </div>
</Form>
