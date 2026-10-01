<script lang="ts">
  // "Denunciar": a table, or someone the reporter shares it with. The server decides again who may
  // be reported; this only offers what the read said is allowed.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { REPORT_DETAILS_MAX, REPORT_REASONS, reportSchema } from '$lib/moderation/reports';
  import { reasonLabel } from '$lib/moderation/labels';
  import Form from '$lib/components/Form.svelte';
  import FormField from '$lib/components/FormField.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { atHandle } from '$lib/profile/handle';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    targets,
    triggerClass = '',
  }: {
    targets: { table: boolean; people: { id: string; username: string }[] };
    triggerClass?: string;
  } = $props();

  let open = $state(false);
  // svelte-ignore state_referenced_locally
  const firstTarget = targets.table ? 'table' : (targets.people[0]?.id ?? 'table');
  const form = actionForm({
    initial: {
      targetType: firstTarget === 'table' ? 'table' : 'player',
      playerId: firstTarget === 'table' ? '' : firstTarget,
      reason: '',
      details: '',
    },
    schema: reportSchema,
    errorMessage: m.report_error,
    onSuccess: () => {
      open = false;
      form.reset();
      toast.success(m.report_sent());
    },
  });
  const data = $derived(form.values);
  const target = $derived(data.targetType === 'table' ? 'table' : data.playerId);

  const codes: Record<string, () => string> = {
    invalid_value: m.report_err_reason,
    too_big: () => m.report_err_details({ max: REPORT_DETAILS_MAX }),
    already_reported: m.report_err_already,
    rate_limited: m.report_err_rate_limited,
    forbidden: m.report_err_forbidden,
    not_found: m.report_err_forbidden,
    required: m.report_err_forbidden,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.report_error()) : undefined);
  const reasonError = $derived(say(form.errors.reason?.[0]));
  const detailsError = $derived(say(form.errors.details?.[0]));
  const formError = $derived(
    say(form.errors._errors?.[0] ?? form.errors.playerId?.[0] ?? form.errors.targetType?.[0]),
  );
  const several = $derived(targets.people.length + (targets.table ? 1 : 0) > 1);
</script>

<Dialog
  {open}
  onOpenChange={(details) => {
    open = details.open;
  }}
>
  <Dialog.Trigger class={triggerClass}>
    <Icon name="flag" size={18} />
    {m.report_trigger()}
  </Dialog.Trigger>
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="max-h-full w-full max-w-lg overflow-y-auto card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold">{m.report_title()}</Dialog.Title>
          <Dialog.Description class="mt-2 text-surface-700-300"
            >{m.report_lede()}</Dialog.Description
          >
          <Form method="POST" action="?/report" onsubmit={form.submit} class="mt-4 grid gap-4">
            <input type="hidden" name="targetType" value={data.targetType} />
            <input type="hidden" name="playerId" value={data.playerId} />

            {#if several}
              <FormField id="report-target" label={m.report_target()}>
                <select
                  id="report-target"
                  class="select h-12 w-full rounded-lg border-surface-200-800 px-3"
                  value={target}
                  onchange={(event) => {
                    const value = event.currentTarget.value;
                    form.change('targetType', value === 'table' ? 'table' : 'player');
                    form.change('playerId', value === 'table' ? '' : value);
                  }}
                >
                  {#if targets.table}<option value="table">{m.report_target_table()}</option>{/if}
                  {#each targets.people as person (person.id)}
                    <option value={person.id}>{atHandle(person.username)}</option>
                  {/each}
                </select>
              </FormField>
            {/if}

            <FormField id="report-reason" label={m.report_reason()} error={reasonError}>
              <select
                id="report-reason"
                name="reason"
                required
                class="select h-12 w-full rounded-lg border-surface-200-800 px-3"
                value={data.reason}
                onchange={(event) => form.change('reason', event.currentTarget.value)}
                aria-invalid={reasonError ? 'true' : undefined}
                aria-describedby={reasonError ? 'report-reason-error' : undefined}
              >
                <option value="" disabled>{m.report_reason_pick()}</option>
                {#each REPORT_REASONS as reason (reason)}
                  <option value={reason}>{reasonLabel(reason)}</option>
                {/each}
              </select>
            </FormField>

            <FormField
              id="report-details"
              label={m.report_details()}
              hint={m.report_details_hint({ max: REPORT_DETAILS_MAX })}
              error={detailsError}
            >
              <textarea
                id="report-details"
                name="details"
                rows="4"
                maxlength={REPORT_DETAILS_MAX}
                class="textarea rounded-lg border-surface-200-800 bg-panel p-3"
                value={data.details}
                oninput={(event) => form.change('details', event.currentTarget.value)}
                aria-invalid={detailsError ? 'true' : undefined}
                aria-describedby="report-details-hint{detailsError ? ' report-details-error' : ''}"
              ></textarea>
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
