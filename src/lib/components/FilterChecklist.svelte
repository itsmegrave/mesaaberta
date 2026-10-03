<script lang="ts">
  // One group of a filter (platforms, tags): every option a checkbox, wrapped chips, no scroll box.
  // The extra options wait behind "Mostrar todas as N tags" unless one of them is ticked.
  import { m } from '$lib/paraglide/messages';

  type Item = { name: string; slug: string };

  let {
    label,
    items,
    more = [],
    picked,
    onchange,
    moreLabel,
  }: {
    label: string;
    items: Item[];
    /** Options past the featured ones. */
    more?: Item[];
    picked: string[];
    onchange: (picked: string[]) => void;
    /** The button that shows `more`; given the number of options. */
    moreLabel?: (count: number) => string;
  } = $props();

  let expanded = $state(false);
  const shown = $derived(expanded ? [...items, ...more] : items);

  const chip =
    'relative inline-flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-surface-200-800 bg-panel px-4 text-sm font-semibold hover:preset-tonal has-checked:border-primary-500 has-checked:preset-filled-primary-500 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary-500';

  const toggle = (slug: string, on: boolean) =>
    onchange(on ? [...picked, slug] : picked.filter((value) => value !== slug));
</script>

<fieldset class="grid gap-2">
  <legend class="label-text font-semibold">{label}</legend>
  <p class="text-sm text-surface-700-300">{m.tables_filter_any_note_short()}</p>
  <div class="flex flex-wrap gap-2">
    {#each shown as item (item.slug)}
      <label class={chip}>
        <input
          type="checkbox"
          class="sr-only"
          checked={picked.includes(item.slug)}
          onchange={(event) => toggle(item.slug, event.currentTarget.checked)}
        />{item.name}
      </label>
    {/each}
  </div>
  {#if more.length > 0 && moreLabel}
    <button
      type="button"
      class="btn min-h-11 justify-start px-0 anchor font-semibold"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      {expanded ? m.tables_filter_fewer() : moreLabel(items.length + more.length)}
    </button>
  {/if}
</fieldset>
