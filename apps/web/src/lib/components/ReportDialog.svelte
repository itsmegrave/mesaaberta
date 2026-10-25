<script lang="ts">
  import SearchSelect from '#lib/components/SearchSelect.svelte';
  // "Denunciar": a table, or someone the reporter shares it with. The server decides again who may
  // be reported; this only offers what the read said is allowed.
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { REPORT_REASONS, reportSchema } from '@mesaaberta/core/moderation/reports';
  import { REPORT_ERRORS, reportError } from '#lib/moderation/report-errors.js';
  import UserLink from '#lib/components/UserLink.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import ReportForm from '#lib/components/ReportForm.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { atHandle } from '@mesaaberta/core/profile/handle';
  import { m } from '#lib/paraglide/messages.js';
  import { toast } from '#lib/toaster.js';

  let {
    targets,
    triggerClass = '',
    trigger = true,
    open = $bindable(false),
  }: {
    targets: { table: boolean; people: { id: string; username: string }[] };
    triggerClass?: string;
    /** Draws its own "Denunciar" button; off when a menu item opens it through `open`. */
    trigger?: boolean;
    open?: boolean;
  } = $props();

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
  const selectedPerson = $derived(targets.people.find((person) => person.id === data.playerId));
  const target = $derived(data.targetType === 'table' ? 'table' : data.playerId);

  // A target left out (`required`) reads as one the reporter may not report.
  const codes = { ...REPORT_ERRORS, required: m.report_err_forbidden };
  const say = (code?: string) => reportError(code, codes);
  const formError = $derived(
    say(form.errors._errors?.[0] ?? form.errors.playerId?.[0] ?? form.errors.targetType?.[0]),
  );
  const several = $derived(targets.people.length + (targets.table ? 1 : 0) > 1);
</script>

<DialogShell
  bind:open
  size="lg"
  scroll
  trigger={trigger ? triggerContent : undefined}
  {triggerClass}
  title={m.report_title()}
  description={m.report_lede()}
>
  <ReportForm
    controller={form}
    prefix="report"
    reasons={REPORT_REASONS}
    hidden={{ targetType: data.targetType, playerId: data.playerId }}
    {say}
    {formError}
  >
    {#snippet head()}
      {#if several}
        <SearchSelect
          id="report-target"
          name="target"
          label={m.report_target()}
          labelClass="label-text block font-semibold"
          class="grid gap-1"
          inDialog
          items={[
            ...(targets.table ? [{ name: m.report_target_table(), slug: 'table' }] : []),
            ...targets.people.map((person) => ({
              name: atHandle(person.username),
              slug: person.id,
            })),
          ]}
          value={target ? [target] : []}
          placeholder={m.report_target()}
          onchange={(picked) => {
            const value = picked[0] ?? '';
            form.change('targetType', value === 'table' ? 'table' : 'player');
            form.change('playerId', value === 'table' ? '' : value);
          }}
        />
      {/if}

      {#if data.targetType === 'player' && selectedPerson}
        <p class="text-sm"><UserLink username={selectedPerson.username} /></p>
      {/if}
    {/snippet}
  </ReportForm>
</DialogShell>

{#snippet triggerContent()}
  <Icon name="flag" size={18} />
  {m.report_trigger()}
{/snippet}
