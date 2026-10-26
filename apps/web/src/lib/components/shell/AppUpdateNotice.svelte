<script lang="ts">
  // The "new version" item pinned atop the bell's list and the feed. It is not a stored
  // notification: it shows while this browser runs an older build than the server (`updated`,
  // polled by SvelteKit), the same state as the banner, so read-all never clears it and a device
  // already on the new build never sees it.
  import MAButton from '#lib/components/ui/MAButton.svelte';
  import NotificationIcon from '#lib/components/ui/NotificationIcon.svelte';
  import { reloadPage } from '#lib/forms/leave-guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  let { compact = false }: { compact?: boolean } = $props();
</script>

<div
  data-testid="app-update-notice"
  class="flex items-start gap-3 rounded-lg border border-primary-500 bg-primary-50-950 text-primary-950-50 {compact
    ? 'p-2'
    : 'p-4'}"
>
  <NotificationIcon icon="sparkles" size={compact ? 20 : 22} class="mt-1" />
  <div class="min-w-0 flex-1">
    <p class="font-semibold {compact ? 'text-sm' : ''}">{m.notification_app_update()}</p>
    <p class="mt-1 text-sm">{m.notification_app_update_text()}</p>
    <MAButton
      variant="primary"
      size="sm"
      class="mt-3 text-sm font-semibold"
      onclick={() => void reloadPage()}
    >
      {m.notification_app_update_refresh()}
    </MAButton>
  </div>
</div>
