<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { DirectoryLink } from '#lib/navigation/directory-nav.js';
  import { m } from '#lib/paraglide/messages.js';

  // The phone's Explorar: the tab bar's fifth item opens a sheet from the bottom with every
  // directory that is on, each with its icon, name and one line on what it lists.
  let {
    links,
    pathname,
    triggerClass,
    trigger,
  }: {
    links: DirectoryLink[];
    pathname: string;
    triggerClass: string;
    /** The tab's own icon and label. */
    trigger: Snippet;
  } = $props();

  let open = $state(false);
</script>

<Dialog {open} onOpenChange={(details) => (open = details.open)}>
  <Dialog.Trigger
    class={triggerClass}
    aria-current={links.some((link) => link.current(pathname)) ? 'page' : undefined}
    >{@render trigger()}</Dialog.Trigger
  >
  {#if open}
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-end">
        <Dialog.Content class="w-full rounded-t-lg bg-panel pb-6 shadow-2xl">
          <div class="flex justify-center pt-2" aria-hidden="true">
            <span class="h-1 w-9 rounded-full bg-surface-200-800"></span>
          </div>
          <div class="flex h-14 items-center justify-between pr-2 pl-5">
            <Dialog.Title class="text-2xl font-semibold tracking-tight"
              >{m.nav_explore()}</Dialog.Title
            >
            <Dialog.CloseTrigger class={buttonClass('ghost', 'icon')} aria-label={m.upload_close()}
              ><Icon name="xmark" size={20} /></Dialog.CloseTrigger
            >
          </div>
          <nav aria-label={m.nav_explore()} class="flex flex-col gap-1 px-2">
            {#each links as link (link.href)}
              {@const current = link.current(pathname)}
              <!-- Following a link closes the sheet: the layout stays mounted across pages. -->
              <a
                href={link.href}
                aria-current={current ? 'page' : undefined}
                onclick={() => (open = false)}
                class="flex min-h-16 items-center gap-3 rounded-lg px-3 py-2 text-surface-950-50 no-underline hover:bg-surface-wash {current
                  ? 'bg-surface-wash'
                  : ''}"
              >
                <span
                  class="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-200-800"
                >
                  <Icon name={link.icon} size={22} />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{link.label()}</span>
                  <span class="block text-sm text-muted">{link.description()}</span>
                </span>
              </a>
            {/each}
          </nav>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  {/if}
</Dialog>
