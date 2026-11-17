<script lang="ts" module>
  /** What is reported from a conversation: one message from someone, or the person. */
  export type MessageReportTarget =
    | { type: 'message'; messageId: string; username: string | null; body: string }
    | { type: 'person'; profileId: string; username: string | null };
</script>

<script lang="ts">
  // "Denunciar mensagem…" and "Denunciar @pessoa…" in Mensagens (`use_message_safety`). The
  // reporter stays anonymous; the server copies the messages around it for the admin and decides
  // again whether this member may report it.
  import ReportForm from '#lib/components/report/ReportForm.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { reportError } from '#lib/moderation/report-errors.js';
  import { toast } from '#lib/toaster.js';
  import { MESSAGE_REPORT_REASONS, messageReportSchema } from '@mesaaberta/core/moderation/reports';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';

  let {
    conversationId,
    target,
    open = $bindable(false),
  }: { conversationId: string; target: MessageReportTarget; open?: boolean } = $props();

  // Mounted for one target (the thread remounts it for another), so these are read once.
  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: {
      targetType: target.type,
      messageId: target.type === 'message' ? target.messageId : '',
      profileId: target.type === 'person' ? target.profileId : '',
      reason: '',
      details: '',
    },
    schema: messageReportSchema,
    refresh: false,
    errorMessage: m.report_error,
    onSuccess: () => {
      open = false;
      form.reset();
      toast.success(m.report_sent());
    },
  });
  const formError = $derived(reportError(form.errors._errors?.[0] ?? form.errors.targetType?.[0]));
  const name = $derived(atHandle(target.username));
</script>

<DialogShell
  bind:open
  size="lg"
  scroll
  sheet
  title={target.type === 'message'
    ? m.messages_report_message_title({ name })
    : m.messages_report_person_title({ name })}
  description={target.type === 'message'
    ? m.messages_report_message_lede()
    : m.messages_report_person_lede()}
>
  <ReportForm
    controller={form}
    action="/m/{conversationId}?/report"
    prefix="message-report"
    reasons={MESSAGE_REPORT_REASONS}
    target={target.type}
    hidden={{
      targetType: form.values.targetType,
      messageId: form.values.messageId,
      profileId: form.values.profileId,
    }}
    {formError}
  >
    {#snippet head()}
      {#if target.type === 'message'}
        <!-- The message as plain text, the way the thread shows it. -->
        <blockquote
          class="rounded-lg border border-surface-200-800 bg-surface-wash p-3 wrap-break-word whitespace-pre-wrap"
        >
          {target.body}
        </blockquote>
      {/if}
    {/snippet}
  </ReportForm>
</DialogShell>
