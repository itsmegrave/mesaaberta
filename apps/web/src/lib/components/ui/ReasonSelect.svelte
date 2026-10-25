<script lang="ts">
  // "Motivo": one of the report reasons, worded for what is reported, with its error line under it
  // (`<id>-error`).
  import FieldError from '#lib/components/ui/FieldError.svelte';
  import SearchSelect from '#lib/components/ui/SearchSelect.svelte';
  import { reasonLabel } from '#lib/moderation/labels.js';
  import type { ReportReason, ReportTarget } from '@mesaaberta/core/moderation/reports';
  import { m } from '#lib/paraglide/messages.js';

  let {
    id,
    reasons,
    target,
    value,
    error,
    onchange,
  }: {
    id: string;
    reasons: readonly ReportReason[];
    /** What the reasons are worded for; a table when left out. */
    target?: ReportTarget;
    value: string;
    error?: string;
    onchange: (reason: string) => void;
  } = $props();
</script>

<div class="min-w-0">
  <SearchSelect
    {id}
    name="reason"
    label={m.report_reason()}
    labelClass="label-text block font-semibold"
    class="grid gap-1"
    inDialog
    required
    invalid={!!error}
    items={reasons.map((reason) => ({ name: reasonLabel(reason, target), slug: reason }))}
    value={value ? [value] : []}
    placeholder={m.report_reason_pick()}
    onchange={(picked) => onchange(picked[0] ?? '')}
  />
  <FieldError {id} message={error} />
</div>
