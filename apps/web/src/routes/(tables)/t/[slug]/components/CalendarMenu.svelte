<script lang="ts">
  // "Adicionar à agenda" in the table's side card, for its GM and confirmed players: Google Agenda
  // (a filled-in link, what works on Android) or the table as an `.ics` (Apple, Outlook and the
  // rest). From md a menu under the button; on a phone a bottom sheet, as on the layout (17.2).
  import { Dialog, Menu, Portal, useDialog } from '@skeletonlabs/skeleton-svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    googleHref,
    icsHref,
    class: className = '',
  }: {
    /** Google Calendar's "new event" address for the table. */
    googleHref: string;
    /** The table's own `.ics` (`/t/:slug/calendar`). */
    icsHref: string;
    class?: string;
  } = $props();

  const wide = new MediaQuery('min-width: 48rem', true);

  type Choice = { id: 'google' | 'ics'; label: string; hint: string; icon: IconName };
  const choices: Choice[] = [
    {
      id: 'google',
      label: m.table_calendar_google(),
      hint: m.table_calendar_google_hint(),
      icon: 'external-link',
    },
    { id: 'ics', label: m.table_calendar_ics(), hint: m.table_calendar_ics_hint(), icon: 'import' },
  ];

  function choose(id: string) {
    if (id === 'google') window.open(googleHref, '_blank', 'noopener,noreferrer');
    else if (id === 'ics') window.location.assign(icsHref);
  }

  const trigger = `${buttonClass('secondary')} w-full gap-2 font-semibold`;

  // The menu's content and the sheet are built only while open: a closed positioner puts an inline
  // `style` on the page, which the CSP refuses.
  let menuOpen = $state(false);
  let sheetOpen = $state(false);
  const sheetId = $props.id();
  const sheet = useDialog({
    id: sheetId,
    onOpenChange: (details) => (sheetOpen = details.open),
  });
</script>

{#snippet label()}
  <Icon name="calendar" size={18} />
  <span>{m.table_calendar_add()}</span>
  <Icon name="chevron-down" size={16} />
{/snippet}

<div class={className}>
  {#if wide.current}
    <Menu
      open={menuOpen}
      onOpenChange={(details) => (menuOpen = details.open)}
      positioning={{ placement: 'bottom-start', sameWidth: true, offset: { mainAxis: 4 } }}
      onSelect={({ value }) => choose(value)}
    >
      <Menu.Trigger class={trigger}>{@render label()}</Menu.Trigger>
      {#if menuOpen}<Portal>
          <Menu.Positioner class="z-50!">
            <Menu.Content
              class="card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
            >
              {#each choices as choice (choice.id)}
                <Menu.Item
                  value={choice.id}
                  class="flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left data-highlighted:preset-tonal"
                >
                  <Icon name={choice.icon} size={20} class="mt-0.5 shrink-0" />
                  <span class="min-w-0 flex-1">
                    <span class="block font-semibold">{choice.label}</span>
                    <span class="block text-sm text-muted">{choice.hint}</span>
                  </span>
                </Menu.Item>
              {/each}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>{/if}
    </Menu>
  {:else}
    <button
      type="button"
      class={trigger}
      aria-haspopup="dialog"
      aria-expanded={sheetOpen}
      onclick={() => sheet().setOpen(true)}>{@render label()}</button
    >
    <Dialog.Provider value={sheet}>
      {#if sheetOpen}<Portal>
          <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
          <Dialog.Positioner class="fixed inset-0 z-50 flex items-end">
            <Dialog.Content class="w-full rounded-t-lg bg-panel px-4 pt-2 pb-8 shadow-2xl">
              <div class="flex justify-center" aria-hidden="true">
                <span class="h-1 w-9 rounded-full bg-surface-200-800"></span>
              </div>
              <div class="mt-2 flex h-12 items-center justify-between">
                <Dialog.Title class="text-xl font-semibold">{m.table_calendar_add()}</Dialog.Title>
                <Dialog.CloseTrigger
                  class="{buttonClass('ghost', 'icon')} -mr-2"
                  aria-label={m.search_select_close()}
                  ><Icon name="xmark" size={20} /></Dialog.CloseTrigger
                >
              </div>
              <ul class="mt-2">
                {#each choices as choice (choice.id)}
                  <li class="border-b border-surface-200-800">
                    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- Google's address, and a file to download -->
                    <a
                      href={choice.id === 'google' ? googleHref : icsHref}
                      target={choice.id === 'google' ? '_blank' : undefined}
                      rel={choice.id === 'google' ? 'noopener noreferrer' : undefined}
                      download={choice.id === 'ics' ? '' : undefined}
                      class="flex min-h-16 items-start gap-3 py-3"
                      onclick={() => sheet().setOpen(false)}
                    >
                      <Icon name={choice.icon} size={22} class="mt-0.5 shrink-0" />
                      <span class="min-w-0 flex-1">
                        <span class="block font-semibold">{choice.label}</span>
                        <span class="block text-sm text-muted">{choice.hint}</span>
                      </span>
                    </a>
                  </li>
                {/each}
              </ul>
              <p class="mt-4 text-sm text-muted">{m.table_calendar_note()}</p>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>{/if}
    </Dialog.Provider>
  {/if}
</div>
