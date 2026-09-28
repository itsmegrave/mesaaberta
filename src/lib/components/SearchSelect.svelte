<script lang="ts">
  // A dropdown with a search box over a long list (the ~700 RPG systems), one or several picks.
  // Until JavaScript runs it is a native <select>, so a form using it works without JS; after that
  // it is Skeleton's Combobox, and the picks are submitted as hidden inputs, one per value.
  import { Combobox, Portal, useListCollection } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages';
  import { matchesSearch } from '$lib/search';

  type Item = { name: string; slug: string };

  let {
    id,
    name,
    label,
    items,
    value = $bindable([]),
    multiple = false,
    placeholder,
    required = false,
    invalid = false,
    labelClass = 'font-semibold',
    class: rootClass = '',
    onchange,
  }: {
    id: string;
    /** The form field: one value when single, the key repeated for each pick when multiple. */
    name: string;
    label: string;
    items: Item[];
    value?: string[];
    multiple?: boolean;
    placeholder: string;
    required?: boolean;
    invalid?: boolean;
    labelClass?: string;
    /** On the wrapper of the label, the control and the picks, to lay them out. */
    class?: string;
    /** After a pick is added or removed, once the hidden inputs are updated. */
    onchange?: (value: string[]) => void;
  } = $props();

  // Rendering all ~700 options at once is slow on a phone; typing narrows the rest.
  const SHOWN = 80;

  let mounted = $state(false);
  onMount(() => (mounted = true));

  const nameOf = (slug: string) => items.find((item) => item.slug === slug)?.name ?? slug;

  // What is being typed, if anything. The list is narrowed by it; otherwise the input shows the
  // picked name (single) or nothing (several, whose picks are chips).
  let typed = $state<string | null>(null);
  const inputValue = $derived(typed ?? (multiple || !value[0] ? '' : nameOf(value[0])));
  const matching = $derived(items.filter((item) => matchesSearch(item.name, typed ?? '')));
  const shown = $derived(matching.slice(0, SHOWN));
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

  const control =
    'flex h-11 w-full items-center rounded-lg border-[1.5px] border-surface-200-800 bg-panel focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary-500';
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
      <Combobox.Input
        class="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] outline-none"
        aria-invalid={invalid || undefined}
      />
      <Combobox.Trigger
        class="flex h-full w-10 shrink-0 items-center justify-center text-muted"
        aria-label={m.search_select_open({ label })}
      >
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
          class="max-h-72 overflow-y-auto card border border-surface-200-800 bg-surface-100-900 p-1.5 shadow-2xl"
        >
          {#each shown as item (item.slug)}
            <Combobox.Item
              {item}
              class="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[15px] data-highlighted:preset-tonal"
            >
              <Combobox.ItemText>{item.name}</Combobox.ItemText>
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
            <li class="px-2.5 py-2 text-[15px] text-muted">{m.search_select_none()}</li>
          {/each}
          {#if matching.length > shown.length}
            <li class="px-2.5 py-2 text-sm text-muted" aria-hidden="true">
              {m.search_select_more({ count: matching.length - shown.length })}
            </li>
          {/if}
        </Combobox.Content>
      </Combobox.Positioner>
    </Portal>

    {#if multiple && value.length > 0}
      <ul
        class="mt-2 flex flex-wrap gap-2 md:col-start-2"
        aria-label={m.search_select_picked({ label })}
      >
        {#each value as slug (slug)}
          <li>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-lg preset-filled-primary-500 pr-2 pl-3 text-sm font-semibold"
              aria-label={m.search_select_remove({ name: nameOf(slug) })}
              onclick={() => remove(slug)}
            >
              {nameOf(slug)}
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
            </button>
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
    <select
      {id}
      {name}
      {multiple}
      {required}
      aria-invalid={invalid || undefined}
      class="select w-full rounded-lg border-surface-200-800 bg-panel px-3 {multiple
        ? 'h-32'
        : 'h-11'}"
    >
      {#if !multiple}<option value="">{placeholder}</option>{/if}
      {#each items as item (item.slug)}
        <option value={item.slug} selected={value.includes(item.slug)}>{item.name}</option>
      {/each}
    </select>
  </div>
{/if}
