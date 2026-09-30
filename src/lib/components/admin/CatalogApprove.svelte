<script lang="ts">
  // Approve: a form with one button, posted to the page's `?/approve`. Each suggestion has its own
  // Superforms id, so a card per suggestion can share the page. It works without JavaScript too.
  import { defaults, superForm } from 'sveltekit-superforms';
  import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
  import { entrySchema, type CatalogKind } from '$lib/admin/catalog';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import { m } from '$lib/paraglide/messages';
  import { toast } from '$lib/toaster';

  let {
    kind,
    id,
    name,
    class: className,
  }: { kind: CatalogKind; id: string; name: string; class: string } = $props();

  // svelte-ignore state_referenced_locally
  const form = superForm(defaults({ kind, id }, zod4(entrySchema)), {
    id: `approve-${id}`,
    validators: zod4Client(entrySchema),
    onUpdated: ({ form: result }) => {
      if (result.valid) toast.success(m.admin_toast_approve());
    },
  });
  const { errors, enhance, submitting, delayed, timeout } = form;
</script>

<form method="POST" action="?/approve" use:enhance>
  <input type="hidden" name="kind" value={kind} />
  <input type="hidden" name="id" value={id} />
  <SubmitButton submitting={$submitting} delayed={$delayed} timeout={$timeout} class={className}
    ><span aria-hidden="true">{m.admin_queue_approve()}</span>
    <span class="sr-only">{m.admin_queue_approve()}: {name}</span></SubmitButton
  >
  {#if $errors._errors?.[0] || $errors.id?.[0]}
    <p role="alert" class="mt-1 text-sm font-semibold text-error-700-300">
      {m.admin_dialog_error()}
    </p>
  {/if}
</form>
