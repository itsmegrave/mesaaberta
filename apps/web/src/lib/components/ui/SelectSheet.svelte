<script lang="ts">
  // A pick-from-a-list field on a phone: the field is a button, so a tap never raises the keyboard,
  // and the list opens in a bottom sheet with 52px options, a radio or a checkbox each. Long lists
  // get a search box at the top that does not take focus on open; while it is typed into, the sheet
  // takes the whole visible height, above the keyboard. One pick closes the sheet; several stay
  // open, listed first, until "Pronto". The state (filtering, picks) is the field's SelectState.
  import type { Snippet } from 'svelte';
  import {
    Dialog,
    Listbox,
    Portal,
    useDialog,
    useListCollection,
  } from '@skeletonlabs/skeleton-svelte';
  import MAButton, { buttonClass } from '#lib/components/ui/MAButton.svelte';
  import Icon from '#lib/components/ui/Icon.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import { m } from '#lib/paraglide/messages.js';
  import type { SelectItem, SelectState } from '#lib/components/ui/select.svelte.js';

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
    searchable,
    pendingLabel = '',
    select,
    extras,
  }: {
    id: string;
    label: string;
    labelClass: string;
    rootClass: string;
    /** The 52px (or 44px) box every field draws. */
    controlClass: string;
    placeholder: string;
    icon?: IconName;
    invalid?: boolean;
    disabled?: boolean;
    multiple?: boolean;
    searchable: boolean;
    pendingLabel?: string;
    select: SelectState;
    /** Under the field: the picks as chips and the hidden inputs. */
    extras: Snippet;
  } = $props();

  let open = $state(false);
  let sheet = $state<HTMLElement | null>(null);
  // While the search is focused the sheet follows the visible viewport, which the phone keyboard
  // shrinks; otherwise it is capped below the top of the screen.
  let searching = $state(false);
  let visible = $state<number | null>(null);

  $effect(() => {
    if (!open || !searching || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const follow = () => (visible = viewport.height);
    follow();
    viewport.addEventListener('resize', follow);
    return () => {
      viewport.removeEventListener('resize', follow);
      visible = null;
    };
  });

  // Set through the CSSOM: a `style` attribute would be refused by the CSP.
  $effect(() => {
    if (sheet) sheet.style.height = searching && visible ? `${visible}px` : '';
  });

  // Several picks list the picked ones first, while the search is empty, so they are easy to undo.
  const picked = $derived(
    multiple && !select.typed
      ? select.value.map((slug) => ({ name: select.nameOf(slug), slug }) as SelectItem)
      : [],
  );
  const rest = $derived(
    picked.length > 0 ? select.options.filter((item) => !select.value.includes(item.slug)) : [],
  );
  const options = $derived(picked.length > 0 ? [...picked, ...rest] : select.options);
  const collection = $derived(
    useListCollection({
      items: options,
      itemToString: (item) => item.name,
      itemToValue: (item) => item.slug,
    }),
  );

  // The sheet is drawn only while open: a closed positioner is a full-screen layer the CSP would
  // leave on top. It opens and closes through the dialog, so its focus trap, scroll lock and hidden
  // page are undone before it leaves.
  const dialogId = $props.id();
  const dialog = useDialog({
    id: dialogId,
    initialFocusEl: () => sheet?.querySelector<HTMLElement>('[role="listbox"]') ?? null,
    onOpenChange: (details) => {
      open = details.open;
      if (open) return;
      searching = false;
      select.typed = null;
    },
  });
  const close = () => dialog().setOpen(false);

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
    // Tapping the picked option again keeps it: a single pick is cleared by picking another.
    if (next[0] && next[0] !== select.value[0]) select.commit([next[0]]);
    close();
  };

  // A pending entry and a suggestion carry their mark after the name.
  const isPending = (item: SelectItem) => item.pending || item.slug.startsWith('new:');

  const valueId = $derived(`${id}-value`);
  const labelId = $derived(`${id}-label`);
</script>

{#snippet body()}
  <div class="flex justify-center pt-2" aria-hidden="true">
    <span class="h-1 w-9 rounded-full bg-surface-200-800"></span>
  </div>
  <div class="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
    <Dialog.Title class="text-2xl font-semibold tracking-tight">{label}</Dialog.Title>
    <Dialog.CloseTrigger class={buttonClass('ghost', 'icon')} aria-label={m.search_select_close()}
      ><Icon name="xmark" size={20} /></Dialog.CloseTrigger
    >
  </div>
  <Listbox
    class="flex min-h-0 flex-1 flex-col"
    {collection}
    value={select.value}
    selectionMode={multiple ? 'multiple' : 'single'}
    typeahead={!searchable}
    defaultHighlightedValue={select.value[0] ?? null}
    onValueChange={(details) => choose(details.value)}
  >
    <Listbox.Label class="sr-only">{label}</Listbox.Label>
    {#if searchable}
      <div class="border-b border-surface-200-800 px-5 pb-3">
        <div class="relative flex items-center">
          <Icon name="search" size={18} class="pointer-events-none absolute left-3.5 text-muted" />
          <Listbox.Input
            type="search"
            class="h-11 w-full rounded-lg border-control border-ink-muted bg-panel pr-3 pl-10 text-base focus:outline-4 focus:outline-offset-2 focus:outline-primary-500"
            placeholder={m.search_select_search()}
            aria-label={m.search_select_search_label({ label })}
            value={select.typed ?? ''}
            oninput={(event) => {
              const typed = (event.currentTarget as HTMLInputElement).value;
              select.typed = typed || null;
            }}
            onfocus={() => (searching = true)}
          />
        </div>
      </div>
    {:else}
      <div class="border-b border-surface-200-800"></div>
    {/if}
    <!-- The list scrolls inside the sheet; the page behind it stays put. -->
    <Listbox.Content
      onkeydown={keepHighlighted}
      class="group min-h-0 flex-1 overflow-y-auto p-2 pb-6 focus-visible:outline-none"
    >
      {#if picked.length > 0}
        <li role="presentation" class="px-3 pt-3 pb-1 text-sm font-semibold text-muted">
          {m.search_select_group_picked()}
        </li>
        {#each picked as item (item.slug)}{@render option(item)}{/each}
        {#if rest.length > 0}
          <li role="presentation" class="px-3 pt-3 pb-1 text-sm font-semibold text-muted">
            {m.search_select_group_rest()}
          </li>
        {/if}
        {#each rest as item (item.slug)}{@render option(item)}{/each}
      {:else}
        {#each options as item (item.slug)}{@render option(item)}{/each}
      {/if}
      {#if options.length === 0}
        <li role="presentation" class="p-3 text-sm text-muted">{m.search_select_none()}</li>
      {/if}
      {#if select.hidden > 0}
        <li role="presentation" class="p-3 text-sm text-muted" aria-hidden="true">
          {m.search_select_more({ count: select.hidden })}
        </li>
      {/if}
    </Listbox.Content>
  </Listbox>
  <p class="sr-only" aria-live="polite">
    {options.length === 0 ? m.search_select_none() : ''}
  </p>
  {#if multiple}
    <div class="flex gap-3 border-t border-surface-200-800 px-5 pt-3 pb-5">
      <MAButton
        type="button"
        variant="secondary"
        size="custom"
        class="btn h-13 flex-1 rounded-lg px-4"
        disabled={select.value.length === 0}
        onclick={() => select.commit([])}>{m.search_select_clear()}</MAButton
      >
      <MAButton
        type="button"
        variant="primary"
        size="custom"
        class="btn h-13 flex-1 rounded-lg px-4"
        onclick={close}>{m.search_select_done({ count: select.value.length })}</MAButton
      >
    </div>
  {/if}
{/snippet}

{#snippet option(item: SelectItem)}
  <Listbox.Item
    {item}
    onclick={() => keep(item.slug)}
    class="flex min-h-13 cursor-pointer items-center gap-3 rounded-lg px-3 text-base group-focus-visible:data-highlighted:outline-2 group-focus-visible:data-highlighted:-outline-offset-2 group-focus-visible:data-highlighted:outline-primary-500 data-selected:bg-surface-wash data-selected:font-semibold"
  >
    <Listbox.ItemText class="min-w-0 flex-1"
      >{item.name}{#if isPending(item) && pendingLabel && !item.slug.startsWith('new:')}
        <span class="text-xs font-normal text-muted">{pendingLabel}</span>{/if}</Listbox.ItemText
    >
    {#if select.value.includes(item.slug)}
      <span
        aria-hidden="true"
        class="flex size-5.5 shrink-0 items-center justify-center border-2 border-primary-500 {multiple
          ? 'rounded preset-filled-primary-500'
          : 'rounded-full'}"
        >{#if multiple}<Icon name="check" size={14} />{:else}<span
            class="size-2.5 rounded-full bg-primary-500"
          ></span>{/if}</span
      >
    {:else}
      <span
        aria-hidden="true"
        class="size-5.5 shrink-0 border-2 border-ink-muted {multiple ? 'rounded' : 'rounded-full'}"
      ></span>
    {/if}
  </Listbox.Item>
{/snippet}

<div class={rootClass}>
  <span id={labelId} class={labelClass}>{label}</span>
  <button
    {id}
    type="button"
    class="{controlClass} cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-50"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-labelledby="{labelId} {valueId}"
    data-invalid={invalid || undefined}
    {disabled}
    onclick={() => dialog().setOpen(true)}
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
  </button>
  {@render extras()}
</div>

<Dialog.Provider value={dialog}>
  {#if open}<Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-end">
        <!-- Long lists open 96px below the top; searching takes the whole visible height. -->
        <Dialog.Content
          class="flex w-full flex-col rounded-t-lg bg-panel shadow-2xl {searchable
            ? searching
              ? 'h-dvh'
              : 'h-[calc(100dvh-6rem)]'
            : 'max-h-[calc(100dvh-6rem)]'}"
        >
          {#snippet element(attributes)}
            <div {...attributes} bind:this={sheet}>{@render body()}</div>
          {/snippet}
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>{/if}
</Dialog.Provider>
