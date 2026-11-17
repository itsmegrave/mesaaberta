<script lang="ts">
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import { m } from '#lib/paraglide/messages.js';
  let { failed, retry }: { failed: boolean; retry: () => unknown } = $props();
</script>

{#if failed}
  <p role="status" class="my-3 text-sm text-muted">
    {m.api_refresh_failed()}
    <MAButton size="custom" type="button" class="btn h-11 px-3 text-link" onclick={() => retry()}
      >{m.api_refresh_retry()}</MAButton
    >
  </p>
{/if}
