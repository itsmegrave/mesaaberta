<script lang="ts">
  import { createSchema } from '$lib/admin/catalog';
  import { actionForm } from './action-form.svelte';
  let { onSuccess }: { onSuccess: () => void } = $props();
  const form = actionForm({
    initial: { kind: 'tag', name: '' },
    schema: createSchema,
    domain: 'catalog',
    onSuccess: () => onSuccess(),
    errorMessage: () => 'transport failed',
  });
</script>

<form method="POST" action="?/create" onsubmit={form.submit}>
  <input type="hidden" name="kind" value="tag" />
  <input
    aria-label="name"
    name="name"
    value={form.values.name}
    aria-invalid={!!form.errors.name}
    oninput={(e) => form.change('name', e.currentTarget.value)}
  />
  <button type="submit">Save</button>
  {#if form.pending}<p>pending</p>{/if}
  {#if form.errors.name}<p role="alert">{form.errors.name[0]}</p>{/if}
  {#if form.errors._errors}<p role="alert">{form.errors._errors[0]}</p>{/if}
</form>
