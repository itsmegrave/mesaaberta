<script lang="ts">
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
  import { pageQuery } from './page.svelte';
  import type { ReadSeed } from './keys';
  let {
    client,
    data,
  }: { client: QueryClient; data: { value: string; account?: unknown; readSeed: ReadSeed } } =
    $props();
  // A test owns this client's lifetime.
  // svelte-ignore state_referenced_locally
  const query = pageQuery(() => data, client);
  let draft = $state('');
</script>

<QueryClientProvider {client}>
  <output aria-label="value">{query.data?.value}</output>
  <input aria-label="draft" bind:value={draft} />
  <button onclick={() => query.refetch()}>Refresh</button>
</QueryClientProvider>
