<script lang="ts">
  import { actionForm } from '$lib/forms/action-form.svelte';
  import TableForm from './TableForm.svelte';
  import type { FormMessage } from '$lib/forms/message';
  import { NEW_TABLE_VALUES, type TableFormValues } from '$lib/tables/form-values';
  import { tableFormSchema } from '$lib/tables/schema';

  type Props = {
    systems: { name: string; slug: string }[];
    submitLabel: string;
    values?: Partial<TableFormValues>;
    errors?: Record<string, string[]>;
    message?: FormMessage;
    imageUrl?: string | null;
    action?: string;
    minCapacity?: number;
    manageHref?: string;
  };
  let {
    systems,
    submitLabel,
    values = {},
    errors,
    message,
    imageUrl,
    action,
    minCapacity,
    manageHref,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  const controller = actionForm({
    initial: { ...NEW_TABLE_VALUES, ...values },
    schema: tableFormSchema,
    initialErrors: errors,
    initialMessage: message,
    onSuccess: () => {},
    errorMessage: () => 'failed',
  });
</script>

<TableForm
  {controller}
  {systems}
  catalog={{
    platforms: [
      { name: 'Discord', slug: 'discord' },
      { name: 'Foundry VTT', slug: 'foundry-vtt' },
    ],
    tags: [
      { name: 'Iniciantes', slug: 'iniciantes' },
      { name: 'Terror', slug: 'terror' },
    ],
  }}
  {submitLabel}
  {imageUrl}
  {action}
  {minCapacity}
  {manageHref}
/>
