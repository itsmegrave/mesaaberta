<script lang="ts">
  // "Editar tipos…" on a partner of `/admin/partners`: the same kind pills as the member's form, sent
  // as one comma-separated field so the decision travels like the others. The server authorizes and
  // validates it again; the partner stays on the page.
  import CheckboxPills from '#lib/components/ui/CheckboxPills.svelte';
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import MAForm from '#lib/components/ui/MAForm.svelte';
  import { actionForm } from '#lib/forms/action-form.svelte.js';
  import { m } from '#lib/paraglide/messages.js';
  import { partnerTypeOptions } from '#lib/partners/type-labels.js';
  import { toast } from '#lib/toaster.js';
  import { partnerTypesSchema } from '@mesaaberta/core/moderation/reports';
  import type { PartnerType } from '@mesaaberta/core/partners/types';

  let {
    partner,
    open = $bindable(false),
  }: { partner: { id: string; name: string; types: PartnerType[] }; open?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  let picked = $state<PartnerType[]>([...partner.types]);

  // svelte-ignore state_referenced_locally
  const form = actionForm<Record<string, string>>({
    initial: { id: partner.id, types: partner.types.join(',') },
    schema: partnerTypesSchema,
    errorMessage: m.admin_dialog_error,
    onSuccess: () => {
      open = false;
      toast.success(m.admin_partners_edit_types_done());
    },
  });
  $effect(() => form.change('types', picked.join(',')));

  const codes: Record<string, () => string> = {
    required: m.partner_err_types_required,
    too_many_types: m.partner_err_too_many_types,
    closed: m.moderation_err_changed,
    not_found: m.moderation_err_changed,
    forbidden: m.moderation_err_forbidden,
  };
  const say = (code?: string) => (code ? (codes[code]?.() ?? m.admin_dialog_error()) : undefined);
  const typesError = $derived(say(form.errors.types?.[0]));
  const formError = $derived(say(form.errors._errors?.[0] ?? form.errors.id?.[0]));
</script>

<DialogShell bind:open scroll description={m.admin_partners_edit_types_text()}>
  {#snippet title()}{m.admin_partners_edit_types_title({ name: partner.name })}{/snippet}
  <MAForm method="POST" action="?/setTypes" onsubmit={form.submit} class="mt-4 grid gap-4">
    <input type="hidden" name="id" value={partner.id} />
    <input type="hidden" name="types" value={picked.join(',')} />
    <!-- The pills only pick: their own `name` stays off the form, the hidden field carries the list. -->
    <CheckboxPills
      name="admin-types"
      legend={m.partner_form_types()}
      hint={m.partner_form_types_hint()}
      options={partnerTypeOptions()}
      bind:group={picked}
      error={typesError}
    />
    {#if formError}
      <p role="alert" class="text-sm font-semibold text-error-700-300">{formError}</p>
    {/if}
    <DialogActions
      cancel={m.admin_dialog_cancel()}
      tone="primary"
      controller={form}
      confirm={m.admin_partners_edit_types_confirm()}
    />
  </MAForm>
</DialogShell>
