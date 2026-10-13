<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import { m } from '$lib/paraglide/messages';
  let { failed, retry }: { failed: boolean; retry: () => unknown } = $props();
</script>

{#if failed}
  <p role="status" class="my-3 text-sm text-muted">
    {m.api_refresh_failed()}
    <Button size="custom" type="button" class="btn h-12 px-3 text-link" onclick={() => retry()}
      >{m.api_refresh_retry()}</Button
    >
  </p>
{/if}
