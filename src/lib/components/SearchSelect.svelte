<script lang="ts">
  import Button from '$lib/components/Button.svelte';
  import SelectInput from '$lib/components/SelectInput.svelte';
  // A dropdown with a search box over a long list (the ~700 RPG systems), one or several picks.
  // Until JavaScript runs it is a native <select>, so a form using it works without JS; after that
  // it is Skeleton's Combobox, and the picks are submitted as hidden inputs, one per value.
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
  let typed = $state<string | null>(null);
  const inputValue = $derived(typed ?? (multiple || !value[0] ? '' : nameOf(value[0])));
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
  const control =
    'flex h-12 w-full items-center overflow-hidden rounded-lg border border-surface-200-800 bg-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500';
  const inputClass =
    'h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 text-sm shadow-none outline-none focus:ring-0';
  const triggerClass =
    'static flex h-full w-12 shrink-0 transform-none items-center justify-center rounded-none bg-transparent text-muted hover:bg-surface-wash';
</script>

{#if mounted}
  <Combobox
    class={rootClass}
    {collection}
    {multiple}
    {value}
    {inputValue}
    {placeholder}
    {required}
    {invalid}
    ids={{ input: id }}
    openOnClick
    closeOnSelect={!multiple}
    selectionBehavior={multiple ? 'clear' : 'replace'}
    inputBehavior="autohighlight"
    positioning={{ sameWidth: true, fitViewport: true }}
    onInputValueChange={(details) => {
      // Typing narrows the list; a pick or a clear shows it whole again.
      typed = details.reason === 'input-change' ? details.inputValue : null;
    }}
    onOpenChange={(details) => {
      if (!details.open) typed = null;
    }}
    onValueChange={(details) => commit(details.value)}
  >
    <Combobox.Label class={labelClass}>{label}</Combobox.Label>
    <Combobox.Control class={control}>
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
    <Portal>
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
    </Portal>

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
  <div class={rootClass}>
    <label for={id} class="block {labelClass}">{label}</label>
    <SelectInput
      {id}
      {name}
      {multiple}
      value={multiple ? value : (value[0] ?? '')}
      {required}
      aria-invalid={invalid || undefined}
      class="select w-full rounded-lg border-surface-200-800 bg-panel px-3 {multiple
        ? 'h-32'
        : 'h-12'}"
    >
      {#if !multiple}<option value="">{placeholder}</option>{/if}
      {#each items as item (item.slug)}
        <option value={item.slug} selected={value.includes(item.slug)}>{item.name}</option>
      {/each}
    </SelectInput>
  </div>
{/if}
