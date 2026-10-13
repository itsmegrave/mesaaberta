<script lang="ts">
  import { actionForm } from '$lib/forms/action-form.svelte';
  import { entrySchema, type CatalogKind } from '$lib/admin/catalog';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import Form from '$lib/components/Form.svelte';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    kind,
    id,
    name,
    class: className,
  }: { kind: CatalogKind; id: string; name: string; class: string } = $props();

  // svelte-ignore state_referenced_locally
  const form = actionForm({
    initial: { kind, id },
    schema: entrySchema,
    domain: 'catalog',
    errorMessage: m.admin_dialog_error,
    onSuccess: () => toast.success(m.admin_toast_approve()),
  });
</script>

<Form action="?/approve" onsubmit={form.submit}>
  <input type="hidden" name="kind" value={kind} />
  <input type="hidden" name="id" value={id} />
  <SubmitButton
    submitting={form.pending}
    delayed={form.delayed}
    timeout={form.timeout}
    class={className}
    ><span aria-hidden="true">{m.admin_queue_approve()}</span>
    <span class="sr-only">{m.admin_queue_approve()}: {name}</span></SubmitButton
  >
  {#if form.errors._errors?.[0] || form.errors.id?.[0]}
    <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {m.admin_dialog_error()}
    </p>
  {/if}
</Form>
