<script lang="ts" module>
  import {
    CROWDFUNDING_REPORT_REASONS,
    PARTNER_REPORT_REASONS,
    PLACE_REPORT_REASONS,
    reportCrowdfundingSchema,
    reportPartnerSchema,
    reportPlaceSchema,
  } from '@mesaaberta/core/moderation/reports';
  import { m } from '#lib/paraglide/messages.js';

  // What each kind of listing is reported with: its schema, its reasons and its words.
  const kinds = {
    crowdfunding: {
      schema: reportCrowdfundingSchema,
      reasons: CROWDFUNDING_REPORT_REASONS,
      title: m.crowdfunding_report_title,
      lede: m.crowdfunding_report_lede,
    },
    partner: {
      schema: reportPartnerSchema,
      reasons: PARTNER_REPORT_REASONS,
      title: m.partner_report_title,
      lede: m.partner_report_lede,
    },
    place: {
      schema: reportPlaceSchema,
      reasons: PLACE_REPORT_REASONS,
      title: m.place_report_title,
      lede: m.place_report_lede,
    },
  };

  export type ReportKind = keyof typeof kinds;
</script>

<script lang="ts">
  // "Denunciar" a crowdfunding campaign, a partner or a place. The reporter stays anonymous; the server
  // decides again whether this member may report it and whether they already did.
  import ReportForm from '#lib/components/report/ReportForm.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { reportError } from '#lib/moderation/report-errors.js';
  import { toast } from '#lib/toaster.js';

  let {
    kind,
    entity,
    open = $bindable(false),
  }: {
    kind: ReportKind;
    entity: { id: string; name: string };
    open?: boolean;
  } = $props();

  // Mounted for one listing (the page remounts it for another), so these are read once.
  // svelte-ignore state_referenced_locally
  const { schema, reasons, title, lede } = kinds[kind];
  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { id: entity.id, reason: '', details: '' },
    schema,
    errorMessage: m.report_error,
    onSuccess: () => {
      open = false;
      form.reset();
      toast.success(m.report_sent());
    },
  });
  const formError = $derived(reportError(form.errors._errors?.[0] ?? form.errors.id?.[0]));
</script>

<DialogShell bind:open size="lg" scroll title={title({ name: entity.name })} description={lede()}>
  <ReportForm
    controller={form}
    prefix="{kind}-report"
    {reasons}
    target={kind}
    hidden={{ id: form.values.id }}
    {formError}
  />
</DialogShell>
