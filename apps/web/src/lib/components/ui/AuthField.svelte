<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import FormField from '#lib/components/ui/FormField.svelte';
  import TextInput from '#lib/components/ui/TextInput.svelte';

  // A field of the sign-in, sign-up and password forms: a FormField around a 52px input with the
  // fields' 1.5px border, which takes the hint and the error by aria.
  let {
    id,
    label,
    hint,
    error,
    value = $bindable(''),
    ...attributes
  }: Omit<HTMLInputAttributes, 'value' | 'class'> & {
    id: string;
    label: string;
    hint?: string;
    error?: string;
    value?: string;
  } = $props();
</script>

<FormField {id} {label} {hint} {error}>
  {#snippet children(aria)}
    <TextInput
      {id}
      {...attributes}
      bind:value
      class="input h-13 w-full rounded-lg border-control border-ink-muted bg-panel px-4 text-base"
      {...aria}
    />
  {/snippet}
</FormField>
