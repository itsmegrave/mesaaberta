<script lang="ts">
  // "Atualizar" in an admin page's head: reads the page's query again, with a spinner while it does.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import Spinner from '#lib/components/ui/Spinner.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { query }: { query: { isFetching: boolean; refetch: () => unknown } } = $props();
</script>

<MAButton
  size="custom"
  type="button"
  class="btn h-11 gap-2 rounded-lg btn-secondary px-4 font-semibold"
  disabled={query.isFetching}
  onclick={() => query.refetch()}
>
  {#if query.isFetching}<Spinner />{:else}<Icon name="refresh-cw" size={18} />{/if}
  {m.admin_refresh()}
</MAButton>
