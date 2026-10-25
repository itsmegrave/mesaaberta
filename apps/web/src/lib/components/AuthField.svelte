<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import FormField from '#lib/components/FormField.svelte';
  import TextInput from '#lib/components/TextInput.svelte';

  // A field of the sign-in, sign-up and password forms: a FormField around a larger input with a
  // stronger border, which takes the hint and the error by aria.
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
      class="input h-12 w-full rounded-lg border-2 border-surface-600-400 bg-panel px-4 text-base"
      {...aria}
    />
  {/snippet}
</FormField>
