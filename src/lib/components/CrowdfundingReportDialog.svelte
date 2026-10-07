<script lang="ts">
  // "Denunciar" a crowdfunding campaign. The reporter stays anonymous; the server decides again
  // whether this member may report it and whether they already did.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import Form from '$lib/components/Form.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import TextArea from '$lib/components/TextArea.svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { reasonLabel } from '$lib/moderation/labels';
  import {
    CROWDFUNDING_REPORT_REASONS,
    REPORT_DETAILS_MAX,
    reportCrowdfundingSchema,
  } from '$lib/moderation/reports';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    campaign,
    open = $bindable(false),
  }: {
    campaign: { id: string; name: string };
    open?: boolean;
  } = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { id: campaign.id, reason: '', details: '' },
    schema: reportCrowdfundingSchema,
    errorMessage: m.report_error,
    onSuccess: () => {
      open = false;
      form.reset();
      toast.success(m.report_sent());
    },
  });
  const data = $derived(form.values);

  const codes: Record<string, () => string> = {
    invalid_value: m.report_err_reason,
    too_big: () => m.report_err_details({ max: REPORT_DETAILS_MAX }),
    already_reported: m.report_err_already,
    rate_limited: m.report_err_rate_limited,
    forbidden: m.report_err_forbidden,
    not_found: m.report_err_forbidden,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.report_error()) : undefined);
  const reasonError = $derived(say(form.errors.reason?.[0]));
  const detailsError = $derived(say(form.errors.details?.[0]));
  const formError = $derived(say(form.errors._errors?.[0] ?? form.errors.id?.[0]));
</script>

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
  }}
>
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="max-h-full w-full max-w-lg overflow-y-auto card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold"
            >{m.crowdfunding_report_title({ name: campaign.name })}</Dialog.Title
          >
          <Dialog.Description class="mt-2 text-surface-700-300"
            >{m.crowdfunding_report_lede()}</Dialog.Description
          >
          <Form method="POST" action="?/report" onsubmit={form.submit} class="mt-4 grid gap-4">
            <input type="hidden" name="id" value={data.id} />

            <div class="min-w-0">
              <SearchSelect
                id="crowdfunding-report-reason"
                name="reason"
                label={m.report_reason()}
                labelClass="label-text block font-semibold"
                class="grid gap-1"
                inDialog
                required
                invalid={!!reasonError}
                items={CROWDFUNDING_REPORT_REASONS.map((reason) => ({
                  name: reasonLabel(reason, 'crowdfunding'),
                  slug: reason,
                }))}
                value={data.reason ? [data.reason] : []}
                placeholder={m.report_reason_pick()}
                onchange={(picked) => form.change('reason', picked[0] ?? '')}
              />
              {#if reasonError}<p
                  id="crowdfunding-report-reason-error"
                  role="alert"
                  class="mt-1 text-sm font-semibold text-error-700-300"
                >
                  {reasonError}
                </p>{/if}
            </div>

            <FormField
              id="crowdfunding-report-details"
              label={m.report_details()}
              hint={m.report_details_hint({ max: REPORT_DETAILS_MAX })}
              error={detailsError}
            >
              <TextArea
                id="crowdfunding-report-details"
                name="details"
                rows={4}
                maxlength={REPORT_DETAILS_MAX}
                class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
                value={data.details}
                oninput={(event) => form.change('details', event.currentTarget.value)}
                aria-invalid={detailsError ? 'true' : undefined}
                aria-describedby="crowdfunding-report-details-hint{detailsError
                  ? ' crowdfunding-report-details-error'
                  : ''}"
              ></TextArea>
            </FormField>

            {#if formError}
              <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
            {/if}

            <div class="mt-2 flex flex-wrap justify-end gap-3">
              <Dialog.CloseTrigger
                class="btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
                >{m.admin_dialog_cancel()}</Dialog.CloseTrigger
              >
              <SubmitButton
                submitting={form.pending}
                delayed={form.delayed}
                timeout={form.timeout}
                class="btn h-12 rounded-lg preset-filled-error-500 px-4 font-semibold"
                >{m.report_submit()}</SubmitButton
              >
            </div>
          </Form>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  {/if}
</Dialog>
