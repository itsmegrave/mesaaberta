<script lang="ts">
  // The logo search runs in the background (the worker's cron, every ten minutes, a few systems
  // at a time): this only says how far it has got.
  import { m } from '#lib/paraglide/messages.js';

  let { unsearched }: { unsearched: number } = $props();
</script>

<section class="mt-6 rounded-lg border border-surface-200-800 p-4 md:p-6">
  {#if unsearched > 0}
    <p class="font-semibold" role="status">{m.admin_logos_unsearched({ count: unsearched })}</p>
    <p class="mt-1 text-sm text-muted">{m.admin_logos_search_hint()}</p>
  {:else}
    <p role="status">{m.admin_logos_search_done()}</p>
  {/if}
</section>
