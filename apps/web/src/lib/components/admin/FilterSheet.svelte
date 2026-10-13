<script lang="ts">
  // The "Filtros" button of a phone list and the sheet it opens, with the filters the desktop toolbar
  // shows in a row. A pick applies at once (the list behind it reloads); "Ver N resultados" closes.
  import type { Snippet } from 'svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages';

  let {
    active = 0,
    results,
    clearHref,
    children,
  }: {
    /** How many filters are on, for the badge on the button. */
    active?: number;
    /** "9 mesas", for the button that closes the sheet. */
    results: string;
    /** Turns every filter off; the link shows only when one is on. */
    clearHref?: string;
    children: Snippet;
  } = $props();

  let open = $state(false);
</script>

<button
  type="button"
  class="btn h-11 shrink-0 gap-2 rounded-lg border-2 border-surface-200-800 bg-panel px-4 font-semibold hover:preset-tonal"
  onclick={() => (open = true)}
>
  <Icon name="filter" size={18} />{m.admin_list_filters()}
  {#if active > 0}<span class="badge rounded-full preset-filled-primary-500 px-2">{active}</span
    >{/if}
</button>

<Dialog {open} onOpenChange={(details) => (open = details.open)}>
  {#if open}<Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 md:hidden">
        <Dialog.Content class="flex size-full flex-col bg-surface-50-950">
          <header
            class="flex items-center justify-between gap-3 border-b border-surface-200-800 px-5 py-3"
          >
            <Dialog.Title class="text-xl font-semibold">{m.admin_list_filters()}</Dialog.Title>
            <Dialog.CloseTrigger
              class="btn size-11 rounded-lg p-0 hover:preset-tonal"
              aria-label={m.confirm_cancel()}><Icon name="xmark" size={20} /></Dialog.CloseTrigger
            >
          </header>
          <div class="grid flex-1 content-start gap-6 overflow-y-auto p-5">
            {@render children()}
          </div>
          <footer class="flex items-center gap-3 border-t border-surface-200-800 p-4">
            {#if clearHref && active > 0}
              <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- already localized -->
              <a class="btn h-12 px-3 anchor font-semibold" href={clearHref}
                >{m.admin_list_clear()}</a
              >
            {/if}
            <Dialog.CloseTrigger
              class="btn h-12 flex-1 rounded-lg preset-filled-primary-500 px-4 font-semibold"
              >{m.admin_list_show({ results })}</Dialog.CloseTrigger
            >
          </footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>{/if}
</Dialog>
