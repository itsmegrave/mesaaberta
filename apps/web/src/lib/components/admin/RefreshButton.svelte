<script lang="ts">
  // "Atualizar" in an admin page's head: reads the page's query again, with a spinner while it does.
  import Button from '#lib/components/Button.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import Spinner from '#lib/components/Spinner.svelte';
  import { m } from '#lib/paraglide/messages.js';

  let { query }: { query: { isFetching: boolean; refetch: () => unknown } } = $props();
</script>

<Button
  size="custom"
  type="button"
  class="btn h-11 gap-2 rounded-lg preset-tonal-primary px-4"
  disabled={query.isFetching}
  onclick={() => query.refetch()}
>
  {#if query.isFetching}<Spinner />{:else}<Icon name="refresh-cw" size={18} />{/if}
  {m.admin_refresh()}
</Button>
