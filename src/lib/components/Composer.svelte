<script lang="ts">
  import { tick } from 'svelte';
  import { superForm, type SuperValidated } from 'sveltekit-superforms';
  import { zod4Client } from 'sveltekit-superforms/adapters';
  import EmojiPicker from '$lib/components/EmojiPicker.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { MESSAGE_MAX_LENGTH, messageSchema, type MessageInput } from '$lib/messages/schema';
  import { m } from '$lib/paraglide/messages';

  type Props = {
    form: SuperValidated<MessageInput, { code: string }>;
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

  // svelte-ignore state_referenced_locally
  const { form, errors, enhance, submitting, delayed, timeout } = superForm(initial, {
    validators: zod4Client(messageSchema),
    resetForm: false,
    invalidateAll: false,
    applyAction: action === '?/send',
    multipleSubmits: 'prevent',
    onSubmit({ formData, cancel }) {
      const body = String(formData.get('body') ?? '').trim();
      if (!messageSchema.safeParse({ body }).success) {
        retrying = null;
        if (savedDraft !== null) $form.body = savedDraft;
        savedDraft = null;
        return cancel();
      }
      notice = null;
      inFlight = retrying ?? onpending(body);
      retrying = null;
      // The box empties at once: the message is a bubble now (a draft set aside for a retry comes
      // back). Superforms checks the values right after this, so the change waits a beat.
      const draft = savedDraft;
      savedDraft = null;
      setTimeout(() => {
        if (draft !== null) $form.body = draft;
        else if ($form.body.trim() === body) $form.body = '';
      }, 0);
    },
    onUpdate({ form: updated }) {
      // Whatever was typed meanwhile is not the server's to overwrite.
      updated.data.body = $form.body;
    },
    onUpdated({ form: updated }) {
      const id = inFlight;
      inFlight = null;
      if (!id) return;
      const code = updated.message?.code;
      if (updated.valid && code === 'sent') {
        void onsent(id);
        return;
      }
      notice = reasons[code ?? '']?.() ?? m.messages_error_generic();
      onfailed(id, code ?? 'invalid');
    },
    onError() {
      const id = inFlight;
      inFlight = null;
      if (!id) return;
      notice = m.messages_error_generic();
      onfailed(id, 'network');
    },
  });

  let selectionStart = 0;
  let selectionEnd = 0;
  const rememberSelection = () => {
    selectionStart = textarea?.selectionStart ?? $form.body.length;
    selectionEnd = textarea?.selectionEnd ?? selectionStart;
  };
  async function insertEmoji(emoji: string) {
    const start = Math.min(selectionStart, $form.body.length);
    const end = Math.min(selectionEnd, $form.body.length);
    const next = $form.body.slice(0, start) + emoji + $form.body.slice(end);
    if (next.length > MESSAGE_MAX_LENGTH) return;
    $form.body = next;
    await tick();
    textarea?.focus();
    textarea?.setSelectionRange(start + emoji.length, start + emoji.length);
    rememberSelection();
  }

  const remaining = $derived(MESSAGE_MAX_LENGTH - $form.body.length);
  const error = $derived($errors.body?.[0]);

  const keydown = (event: KeyboardEvent) => {
    // Enter sends, Shift+Enter breaks the line, and a key that confirms an input method's text does neither.
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229)
      return;
    event.preventDefault();
    if ($form.body.trim()) formEl?.requestSubmit();
  };

  /** Sends a failed message again, keeping what is being typed in the box. */
  export async function retry(id: string, body: string) {
    if (inFlight) return;
    savedDraft = $form.body;
    retrying = id;
    $form.body = body;
    await tick();
    formEl?.requestSubmit();
  }

  export function focus() {
    textarea?.focus();
  }
</script>

<form
  bind:this={formEl}
  method="POST"
  {action}
  use:enhance
  class="flex min-w-0 flex-col gap-2 border-t border-surface-200-800 pt-3"
>
  {#if $form.tableId}<input type="hidden" name="tableId" value={$form.tableId} />{/if}
  <div
    class="flex items-end gap-1 rounded-xl border border-surface-200-800 bg-panel p-1 focus-within:ring-2 focus-within:ring-primary-500"
  >
    <EmojiPicker onselect={insertEmoji} finalFocusEl={() => textarea ?? null} />
    <label for="message-body" class="sr-only">{m.messages_composer_label()}</label>
    <textarea
      id="message-body"
      name="body"
      bind:this={textarea}
      bind:value={$form.body}
      onkeydown={keydown}
      onselect={rememberSelection}
      oninput={rememberSelection}
      onblur={rememberSelection}
      rows="1"
      maxlength={MESSAGE_MAX_LENGTH}
      placeholder={m.messages_composer_placeholder()}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error || notice ? 'message-notice' : undefined}
      class="textarea field-sizing-content max-h-40 min-h-12 min-w-0 flex-1 resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-2 py-3 shadow-none focus:outline-none"
    ></textarea>
    <SubmitButton
      submitting={$submitting}
      delayed={$delayed}
      timeout={$timeout}
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
      <p class="ml-auto text-muted" aria-live="polite">{$form.body.length}/{MESSAGE_MAX_LENGTH}</p>
    {/if}
  </div>
</form>
