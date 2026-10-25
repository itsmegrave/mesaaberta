<script lang="ts">
  // Mounted once, in the root layout. It opens when a form with unsaved changes calls
  // `confirmLeave` (the shared draft guard) and answers it.
  import DialogActions from '#lib/components/ui/DialogActions.svelte';
  import DialogShell from '#lib/components/ui/DialogShell.svelte';
  import { leaveGuard } from '#lib/forms/leave-guard.svelte.js';
  import { m } from '#lib/paraglide/messages.js';

  const answer = (leave: boolean) => leaveGuard.pending?.(leave);
</script>

<!-- Mounted only while a form is asking: Skeleton's Dialog opens on mount, and Escape or the
     backdrop answers "stay". -->
{#if leaveGuard.pending}
  <DialogShell
    defaultOpen
    onOpenChange={(open) => {
      if (!open) answer(false);
    }}
    role="alertdialog"
    title={m.unsaved_title()}
    description={m.unsaved_text()}
  >
    <DialogActions
      class="mt-6"
      cancel={m.unsaved_stay()}
      oncancel={() => answer(false)}
      tone="danger"
      confirm={m.unsaved_leave()}
      onconfirm={() => answer(true)}
    />
  </DialogShell>
{/if}
