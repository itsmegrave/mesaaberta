<script lang="ts">
  // The body of every "Denunciar" dialog: the reason, the details, why the server refused, and the
  // footer. The ids start with `prefix` (`report-reason`, `partner-report-details`…). `head` goes
  // before the reason: ReportDialog's choice of what is reported.
  import type { Snippet } from 'svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import FormField from '#lib/components/ui/FormField.svelte';
  import ReasonSelect from '#lib/components/ui/ReasonSelect.svelte';
  import MATextArea from '#lib/components/ui/MATextArea.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import type { FormErrors } from '#lib/forms/contract.js';
  import { reportError } from '#lib/moderation/report-errors.js';
  import {
    REPORT_DETAILS_MAX,
    type ReportReason,
    type ReportTarget,
  } from '@mesaaberta/core/moderation/reports';
  import { m } from '#lib/paraglide/messages.js';

  let {
    controller,
    prefix,
    reasons,
    target,
    hidden,
    say = reportError,
    formError,
    head,
  }: {
    controller: {
      values: { reason: string; details: string };
      errors: FormErrors;
      pending: boolean;
      delayed: boolean;
      timeout: boolean;
      submit: (event: SubmitEvent) => unknown;
      change: (field: 'reason' | 'details', value: string) => void;
    };
    prefix: string;
    reasons: readonly ReportReason[];
    /** What the reasons are worded for; a table when left out. */
    target?: ReportTarget;
    /** The fields that say what is reported, posted as they are. */
    hidden: Record<string, string>;
    /** The sentence for an error code. */
    say?: (code?: string) => string | undefined;
    /** Why the server refused, when it was not about the reason or the details. */
    formError?: string;
    head?: Snippet;
  } = $props();

  const reasonError = $derived(say(controller.errors.reason?.[0]));
  const detailsError = $derived(say(controller.errors.details?.[0]));
</script>

<MAForm method="POST" action="?/report" onsubmit={controller.submit} class="mt-4 grid gap-4">
  {#each Object.entries(hidden) as [name, value] (name)}
    <input type="hidden" {name} {value} />
  {/each}

  {@render head?.()}

  <ReasonSelect
    id="{prefix}-reason"
    {reasons}
    {target}
    value={controller.values.reason}
    error={reasonError}
    onchange={(reason) => controller.change('reason', reason)}
  />

  <FormField
    id="{prefix}-details"
    label={m.report_details()}
    hint={m.report_details_hint({ max: REPORT_DETAILS_MAX })}
    error={detailsError}
  >
    <MATextArea
      id="{prefix}-details"
      name="details"
      rows={4}
      maxlength={REPORT_DETAILS_MAX}
      class="textarea rounded-lg border-control border-ink-muted bg-panel p-3"
      value={controller.values.details}
      oninput={(event) => controller.change('details', event.currentTarget.value)}
      aria-invalid={detailsError ? 'true' : undefined}
      aria-describedby="{prefix}-details-hint{detailsError ? ` ${prefix}-details-error` : ''}"
    ></MATextArea>
  </FormField>

  {#if formError}
    <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
  {/if}

  <DialogActions
    cancel={m.admin_dialog_cancel()}
    tone="danger"
    {controller}
    confirm={m.report_submit()}
  />
</MAForm>
