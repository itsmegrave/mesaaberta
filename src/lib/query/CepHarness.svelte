<script lang="ts">
  import CepLookup from '$lib/components/CepLookup.svelte';
  let { value, initial = '' }: { value: string; initial?: string } = $props();
  // This models a user-owned form field, initialized once.
  // svelte-ignore state_referenced_locally
  let area = $state(initial);
</script>

<CepLookup {value} bind:area />
<input aria-label="region" bind:value={area} />
