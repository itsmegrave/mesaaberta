<script lang="ts">
  import RichTextField from './RichTextField.svelte';

  let { initial = '', maxlength = 100 }: { initial?: string; maxlength?: number } = $props();
  // svelte-ignore state_referenced_locally
  let value = $state(initial);
</script>

<label id="notes-label" for="notes">Notas</label>
<RichTextField id="notes" name="notes" {maxlength} bind:value />
<output data-testid="value">{value}</output>
