<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons/names';
  // A dropdown with a search box over a long list (the ~700 RPG systems), one or several picks.
  // Skeleton's Combobox; the picks are submitted as hidden inputs, one per value. Until the page is
  // interactive an inert box of the same size stands in.
  // With `suggestLabel` (several picks only), a name the list lacks can be picked as it was typed:
  // it is submitted as `new:<name>` (see $lib/tables/catalog) for the server to take as a suggestion.
  import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import { foldForSearch, matchesSearch } from '$lib/search';
  import { NEW_CATALOG_PREFIX, SUGGESTION_NAME, pickName } from '$lib/tables/catalog';

  /** `pending`: an entry not approved yet, marked with `pendingLabel`. */
  type Item = { name: string; slug: string; pending?: true };

  let {
    id,
    name,
    label,
    items,
    value = $bindable([]),
    multiple = false,
    showPicks = true,
    compact = false,
    disabled = false,
    inDialog = false,
    icon,
    summary = false,
    placeholder,
    required = false,
    invalid = false,
    labelClass = 'font-semibold',
    class: rootClass = '',
    onchange,
    suggestLabel,
    pendingLabel = '',
  }: {
    id: string;
    /** The form field: one value when single, the key repeated for each pick when multiple. */
    name: string;
    label: string;
    items: Item[];
    value?: string[];
    multiple?: boolean;
    /** Several picks: show them as removable chips under the box. Off when the page shows them. */
    showPicks?: boolean;
    /** A shorter box (44px, the least a touch target takes), for a filter or a page size. */
    compact?: boolean;
    disabled?: boolean;
    /**
     * Inside a dialog: the list opens in place (a dialog keeps out whatever is drawn outside it) and
     * is positioned on the screen, so the dialog's own scrolling does not cut it.
     */
    inDialog?: boolean;
    /** Drawn at the start of the box. */
    icon?: IconName;
    /** Several picks, shown closed as the first one and "+N" ("Discord +1") instead of as chips. */
    summary?: boolean;
    placeholder: string;
    required?: boolean;
    invalid?: boolean;
    labelClass?: string;
    /** On the wrapper of the label, the control and the picks, to lay them out. */
    class?: string;
    /** After a pick is added or removed, once the hidden inputs are updated. */
    onchange?: (value: string[]) => void;
    /** The option that picks a name the list lacks ("Sugerir “x”"). Without it, none is offered. */
    suggestLabel?: (name: string) => string;
    /** Next to a pending entry and a suggested name: "em análise". */
    pendingLabel?: string;
  } = $props();

  // Rendering all ~700 options at once is slow on a phone; typing narrows the rest.
  const SHOWN = 80;

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const nameOf = (slug: string) => pickName(items, slug);
  // A pick not approved yet: a pending entry, or a name suggested just now.
  const isPending = (slug: string) =>
    slug.startsWith(NEW_CATALOG_PREFIX) || items.some((item) => item.slug === slug && item.pending);
  const chipName = (slug: string) =>
    isPending(slug) && pendingLabel ? `${nameOf(slug)} (${pendingLabel})` : nameOf(slug);

  // What is being typed, if anything. The list is narrowed by it; otherwise the input shows the
  // picked name (single) or nothing (several, whose picks are chips).
  // The list is built when it opens: a closed one would put an inline `style` on the page, which
  // the CSP refuses.
  let open = $state(false);
  let typed = $state<string | null>(null);
  const summarized = $derived(
    value.length > 1 ? `${nameOf(value[0])} +${value.length - 1}` : nameOf(value[0]),
  );
  const inputValue = $derived(
    typed ?? (!value[0] ? '' : multiple ? (summary && !open ? summarized : '') : nameOf(value[0])),
  );
  const matching = $derived(items.filter((item) => matchesSearch(item.name, typed ?? '')));
  // What was typed, tidied, when it can be suggested: long enough and not a name the list has.
  const suggestion = $derived.by((): Item | null => {
    const name = (typed ?? '').trim().replace(/\s+/g, ' ');
    if (!suggestLabel || !multiple) return null;
    if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max) return null;
    if (items.some((item) => foldForSearch(item.name) === foldForSearch(name))) return null;
    return { name: suggestLabel(name), slug: `${NEW_CATALOG_PREFIX}${name}` };
  });
  const shown = $derived([...matching.slice(0, SHOWN), ...(suggestion ? [suggestion] : [])]);
  const collection = $derived(
    useListCollection({
      items: shown,
      itemToString: (item) => item.name,
      itemToValue: (item) => item.slug,
    }),
  );

  const commit = (next: string[]) => {
    value = next;
    // The hidden inputs follow `value` on the next render; the change is announced after that.
    queueMicrotask(() => onchange?.(next));
  };
  const remove = (slug: string) => commit(value.filter((picked) => picked !== slug));

  // One box, like the other inputs. Skeleton gives the Combobox input its own `input` look and the
  // trigger a tonal button pinned inside the control; both are undone below so only this box draws.
  const control = $derived(
    `flex ${compact ? 'h-11' : 'h-12'} w-full items-center overflow-hidden rounded-lg border ${summary && value.length > 0 ? 'border-primary-500' : 'border-surface-200-800'} bg-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500`,
  );
  const inputClass =
    'h-full min-w-0 flex-1 rounded-none! border-0! bg-transparent px-3 text-sm shadow-none! ring-0! outline-none focus:ring-0!';
  const triggerClass =
    'static flex h-full w-12 shrink-0 transform-none items-center justify-center rounded-none! border-0! bg-transparent text-muted hover:bg-surface-wash';
</script>

{#snippet list()}
  <Combobox.Positioner class="z-50!">
    <Combobox.Content
      class="max-h-72 overflow-y-auto card border border-surface-200-800 bg-surface-100-900 p-1 shadow-2xl"
    >
      {#each shown as item (item.slug)}
        <Combobox.Item
          {item}
          class="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md p-2 text-sm data-highlighted:preset-tonal"
        >
          <Combobox.ItemText
            >{item.name}{#if item.pending && pendingLabel}
              <span class="text-xs font-normal text-muted">{pendingLabel}</span
              >{/if}</Combobox.ItemText
          >
          <Combobox.ItemIndicator class="shrink-0 text-primary-500">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg
            >
          </Combobox.ItemIndicator>
        </Combobox.Item>
      {:else}
        <li class="p-2 text-sm text-muted">{m.search_select_none()}</li>
      {/each}
      {#if matching.length > SHOWN}
        <li class="p-2 text-sm text-muted" aria-hidden="true">
          {m.search_select_more({ count: matching.length - SHOWN })}
        </li>
      {/if}
    </Combobox.Content>
  </Combobox.Positioner>
{/snippet}

{#if mounted}
  <Combobox
    class={rootClass}
    {collection}
    {open}
    {multiple}
    {value}
    {inputValue}
    {placeholder}
    {required}
    {invalid}
    {disabled}
    ids={{ input: id }}
    openOnClick
    closeOnSelect={!multiple}
    selectionBehavior={multiple ? 'clear' : 'replace'}
    inputBehavior="autohighlight"
    positioning={{ sameWidth: true, fitViewport: true, strategy: inDialog ? 'fixed' : 'absolute' }}
    onInputValueChange={(details) => {
      // Typing narrows the list; a pick or a clear shows it whole again.
      typed = details.reason === 'input-change' ? details.inputValue : null;
    }}
    onOpenChange={(details) => {
      open = details.open;
      if (!details.open) typed = null;
    }}
    onValueChange={(details) => commit(details.value)}
  >
    <Combobox.Label class={labelClass}>{label}</Combobox.Label>
    <Combobox.Control class={control}>
      {#if icon}<Icon name={icon} size={18} class="ml-3 text-muted" />{/if}
      <Combobox.Input class={inputClass} aria-invalid={invalid || undefined} />
      <Combobox.Trigger class={triggerClass} aria-label={m.search_select_open({ label })}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg
        >
      </Combobox.Trigger>
    </Combobox.Control>
    {#if open}
      {#if inDialog}{@render list()}{:else}<Portal>{@render list()}</Portal>{/if}
    {/if}

    {#if multiple && showPicks && value.length > 0}
      <ul
        class="mt-2 flex flex-wrap gap-2 md:col-start-2"
        aria-label={m.search_select_picked({ label })}
      >
        {#each value as slug (slug)}
          <li>
            <Button
              size="custom"
              type="button"
              class="inline-flex h-11 items-center gap-1 rounded-lg preset-filled-primary-500 pr-2 pl-3 text-sm font-semibold"
              aria-label={m.search_select_remove({ name: chipName(slug) })}
              onclick={() => remove(slug)}
            >
              {nameOf(slug)}{#if isPending(slug) && pendingLabel}<span
                  class="text-xs font-normal opacity-80">· {pendingLabel}</span
                >{/if}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
              >
            </Button>
          </li>
        {/each}
      </ul>
    {/if}

    <div hidden>
      {#each value as slug (slug)}<input type="hidden" {name} value={slug} />{/each}
    </div>
  </Combobox>
{:else}
  <!-- Until the page is interactive: the box as it will be, so nothing moves when it is. -->
  <div class={rootClass}>
    <span class="block {labelClass}">{label}</span>
    <div class={control} aria-hidden="true">
      {#if icon}<Icon name={icon} size={18} class="ml-3 text-muted" />{/if}
      <span
        class="min-w-0 flex-1 truncate px-3 text-sm {value[0] && (!multiple || summary)
          ? ''
          : 'text-muted'}">{value[0] && (!multiple || summary) ? summarized : placeholder}</span
      >
    </div>
  </div>
{/if}
