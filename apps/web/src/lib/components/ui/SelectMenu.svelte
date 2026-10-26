<script lang="ts">
  // A short pick-from-a-list field on a wide screen (10 options or fewer): the field is a button and
  // the list hangs under it, with no search. ↓/↑ (or Alt+↓) open it, the arrows move, letters jump to
  // the next option that starts with them, Enter or Space picks, Escape closes back to the field.
  // The state (picks, names) is the field's SelectState.
  import type { Snippet } from 'svelte';
  import {
    Listbox,
    Popover,
    Portal,
    useListCollection,
    usePopover,
  } from '@skeletonlabs/skeleton-svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import type { SelectState } from '#lib/components/ui/select.svelte.js';

  let {
    id,
    label,
    labelClass,
    rootClass,
    controlClass,
    placeholder,
    icon,
    invalid = false,
    disabled = false,
    multiple = false,
    inDialog = false,
    pendingLabel = '',
    select,
    extras,
  }: {
    id: string;
    label: string;
    labelClass: string;
    rootClass: string;
    controlClass: string;
    placeholder: string;
    icon?: IconName;
    invalid?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    /** Positioned on the screen, so a dialog's own scrolling does not cut the list. */
    inDialog?: boolean;
    pendingLabel?: string;
    select: SelectState;
    /** Under the field: the picks as chips and the hidden inputs. */
    extras: Snippet;
  } = $props();

  let open = $state(false);
  let list = $state<HTMLElement | null>(null);

  const collection = $derived(
    useListCollection({
      items: select.options,
      itemToString: (item) => item.name,
      itemToValue: (item) => item.slug,
    }),
  );

  // Back on the field after a pick or Escape; the list that held the focus is gone by then.
  const refocus = () => requestAnimationFrame(() => document.getElementById(id)?.focus());

  // Opened and closed through the popover itself: a closed `open` prop alone leaves it thinking it
  // is open, and the next click on the field would close it instead.
  const popoverId = $props.id();
  const popover = usePopover(() => ({
    id: popoverId,
    ids: { trigger: id },
    onOpenChange: (details) => (open = details.open),
    onEscapeKeyDown: refocus,
    initialFocusEl: () => list?.querySelector<HTMLElement>('[role="listbox"]') ?? null,
    positioning: {
      placement: 'bottom-start',
      sameWidth: true,
      fitViewport: true,
      offset: { mainAxis: 4 },
      strategy: inDialog ? 'fixed' : 'absolute',
    },
  }));
  const close = () => {
    popover().setOpen(false);
    refocus();
  };

  // The list reports no change for the option already picked, so picking it again closes here.
  const keep = (slug: string | null | undefined) => {
    if (!multiple && slug && slug === select.value[0]) close();
  };
  const keepHighlighted = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const active = (event.currentTarget as HTMLElement).getAttribute('aria-activedescendant');
    keep(active ? document.getElementById(active)?.dataset.value : null);
  };

  const choose = (next: string[]) => {
    if (multiple) return select.commit(next);
    if (next[0] && next[0] !== select.value[0]) select.commit([next[0]]);
    close();
  };

  const labelId = $derived(`${id}-label`);
  const valueId = $derived(`${id}-value`);
</script>

<div class={rootClass}>
  <span id={labelId} class={labelClass}>{label}</span>
  <Popover.Provider value={popover}>
    <Popover.Trigger
      class="{controlClass} cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
      aria-haspopup="listbox"
      aria-labelledby="{labelId} {valueId}"
      data-invalid={invalid || undefined}
      {disabled}
      onkeydown={(event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        popover().setOpen(true);
      }}
    >
      {#if icon}<Icon name={icon} size={18} class="ml-3 shrink-0 text-muted" />{/if}
      <span
        id={valueId}
        class="min-w-0 flex-1 truncate px-3 text-sm {select.shown ? '' : 'text-muted'}"
        >{select.shown || placeholder}</span
      >
      <span class="flex h-full w-12 shrink-0 items-center justify-center text-muted"
        ><Icon name="chevron-down" size={16} /></span
      >
    </Popover.Trigger>
    <!-- Drawn only while open: a closed positioner would put an inline style on the page. -->
    {#if open}
      {#snippet content()}
        <Popover.Positioner class="z-50!">
          <Popover.Content
            class="max-h-72 overflow-y-auto card border border-surface-200-800 bg-surface-100-900 p-1 shadow-2xl"
          >
            <div bind:this={list}>
              <Listbox
                {collection}
                value={select.value}
                selectionMode={multiple ? 'multiple' : 'single'}
                typeahead
                defaultHighlightedValue={select.value[0] ?? select.options[0]?.slug ?? null}
                onValueChange={(details) => choose(details.value)}
              >
                <Listbox.Label class="sr-only">{label}</Listbox.Label>
                <Listbox.Content
                  class="group focus-visible:outline-none"
                  onkeydown={keepHighlighted}
                >
                  {#each select.options as item (item.slug)}
                    <Listbox.Item
                      {item}
                      onclick={() => keep(item.slug)}
                      highlightOnHover
                      class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm data-highlighted:bg-surface-wash group-focus-visible:data-highlighted:outline-2 group-focus-visible:data-highlighted:-outline-offset-2 group-focus-visible:data-highlighted:outline-primary-500 data-selected:font-semibold"
                    >
                      <span class="flex w-4 shrink-0 text-primary-500" aria-hidden="true"
                        >{#if select.value.includes(item.slug)}<Icon
                            name="check"
                            size={16}
                          />{/if}</span
                      >
                      <Listbox.ItemText class="min-w-0 flex-1"
                        >{item.name}{#if item.pending && pendingLabel}
                          <span class="text-xs font-normal text-muted">{pendingLabel}</span
                          >{/if}</Listbox.ItemText
                      >
                    </Listbox.Item>
                  {/each}
                </Listbox.Content>
              </Listbox>
            </div>
          </Popover.Content>
        </Popover.Positioner>
      {/snippet}
      {#if inDialog}{@render content()}{:else}<Portal>{@render content()}</Portal>{/if}
    {/if}
  </Popover.Provider>
  {@render extras()}
</div>
