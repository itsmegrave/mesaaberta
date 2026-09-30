<script lang="ts">
  import { untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { createQuery } from '@tanstack/svelte-query';
  import { queryClient } from '$lib/query/context';
  import { cepLookup } from '$lib/query/lookups';
  import { areaOf, normalizeCep } from '$lib/location/cep';
  import { m } from '$lib/paraglide/messages';
  let { value, area = $bindable('') }: { value: string; area?: string } = $props();
  const client = queryClient();
  let debounced = $state<string | null>(null);
  let filled = $state<string | null>(null);
  const cep = $derived(normalizeCep(value));
  $effect(() => {
    const next = cep;
    debounced = null;
    untrack(() => {
      if (filled && area === filled) area = '';
      filled = null;
    });
    if (!next) return;
    const timer = setTimeout(() => {
      debounced = next;
    }, 400);
    return () => clearTimeout(timer);
  });
  const lookup = createQuery(
    () => ({
      queryKey: ['api', 'cep', debounced],
      queryFn: async ({ signal, queryKey }) => {
        const requested = queryKey[2]!;
        return { ...(await cepLookup(requested, signal)), cep: requested };
      },
      enabled: browser && !!debounced && debounced === cep,
      staleTime: (query) => (query.state.data?.status === 'found' ? 86_400_000 : 0),
      refetchOnWindowFocus: false,
      retry: false,
    }),
    () => client,
  );
  $effect(() => {
    if (!cep || debounced !== cep || lookup.data?.cep !== cep || lookup.data.status !== 'found')
      return;
    const suggested = areaOf(lookup.data.place);
    if (!area || area === filled) {
      area = suggested;
      filled = suggested;
    }
  });
</script>

{#if cep}
  <p class="mt-1 text-sm text-muted" role="status">
    {#if debounced !== cep || lookup.isFetching}{m.cep_lookup_pending()}
    {:else if lookup.isError}{m.cep_lookup_unavailable()}
    {:else if lookup.data?.status === 'not_found'}{m.cep_lookup_missing()}
    {:else if lookup.data?.status === 'found'}{areaOf(lookup.data.place)}{/if}
  </p>
{/if}
