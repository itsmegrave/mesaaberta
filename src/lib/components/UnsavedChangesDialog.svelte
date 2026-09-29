<script lang="ts">
  // Mounted once, in the root layout. It opens when a form with unsaved changes calls
  // `confirmLeave` (Superforms' `taintedMessage`) and answers it.
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { leaveGuard } from '$lib/forms/leave-guard.svelte';
  import { m } from '$lib/paraglide/messages';

  const answer = (leave: boolean) => leaveGuard.pending?.(leave);
</script>

<!-- Mounted only while a form is asking: Skeleton's Dialog opens on mount, and Escape or the
     backdrop answers "stay". -->
{#if leaveGuard.pending}
  <Dialog
    defaultOpen
    onOpenChange={(details) => {
      if (!details.open) answer(false);
    }}
    role="alertdialog"
  >
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content
          class="w-full max-w-md card border border-surface-200-800 bg-surface-50-950 p-6 shadow-2xl"
        >
          <Dialog.Title class="text-xl font-semibold">{m.unsaved_title()}</Dialog.Title>
          <Dialog.Description class="mt-2 text-surface-700-300"
            >{m.unsaved_text()}</Dialog.Description
          >
          <div class="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              class="btn h-11 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal"
              onclick={() => answer(false)}>{m.unsaved_stay()}</button
            >
            <button
              type="button"
              class="btn h-11 rounded-lg preset-filled-error-500 px-4 font-semibold"
              onclick={() => answer(true)}>{m.unsaved_leave()}</button
            >
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog>
{/if}
