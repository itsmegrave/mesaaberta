<script lang="ts">
  import FormField from './FormField.svelte';

  let {
    hint,
    error,
    optional = false,
    counter,
  }: {
    hint?: string;
    error?: string;
    optional?: boolean;
    counter?: { count: number; max: number };
  } = $props();
</script>

<FormField id="title" label="Título" {hint} {error} {optional} {counter}>
  {#snippet children(field)}
    <input id="title" name="title" {...field} />
  {/snippet}
</FormField>
