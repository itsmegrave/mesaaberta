<script lang="ts">
  import QueryStatus from '#lib/components/ui/QueryStatus.svelte';
  import { pageQuery } from '#lib/query/page.svelte.js';
  import LandingHome from './components/LandingHome.svelte';
  import SignedInHome from './components/SignedInHome.svelte';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  // The cached read has the shape the server loaded, landing or Início.
  const data = $derived({ ...serverData, ...remote.data } as typeof serverData);
</script>

<QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

{#if data.signedInHome}
  <SignedInHome {data} />
{:else}
  <LandingHome {data} />
{/if}
