<script lang="ts">
  // The list's filters. On a desktop one row: the system, the modality, a multi-select box each for
  // the platforms and the tags. On a phone the modality and a "Filtros (N)" button that opens a
  // full-screen sheet with all of them. A change applies at once (the list reloads on the new
  // query); the picks show as removable chips under it. The query string is the contract: a slug
  // per pick, a key repeated per value, so a link to a filtered list keeps working.
  import { goto } from '$app/navigation';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '$lib/components/Icon.svelte';
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import { modalityIcon } from '$lib/tables/modality-icon';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  type Item = { name: string; slug: string };
  type Picks = {
    systems: string[];
    modality: string | null;
    platforms: string[];
    tags: string[];
  };

  let {
    systems,
    catalog,
    picked,
    count,
  }: {
    systems: Item[];
    catalog: { platforms: Item[]; tags: Item[]; moreTags: Item[] };
    picked: Picks;
    /** How many tables the list shows with these filters. */
    count: number;
  } = $props();

  const locale = getLocale();

  const query = (next: Picks) => {
    const parts = [
      ...next.systems.map((slug) => `system=${encodeURIComponent(slug)}`),
      next.modality ? `modality=${next.modality}` : '',
      ...next.platforms.map((slug) => `platform=${encodeURIComponent(slug)}`),
      ...next.tags.map((slug) => `tag=${encodeURIComponent(slug)}`),
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };
  const apply = (change: Partial<Picks>) =>
    goto(localizedHref(`/tables${query({ ...picked, ...change })}`, locale), {
      keepFocus: true,
      noScroll: true,
    });

  const modalities = [
    { value: null, label: m.tables_filter_modality_all },
    { value: 'online', label: m.table_modality_online },
    { value: 'in_person', label: m.table_modality_in_person },
  ] as const;

  const allTags = $derived([...catalog.tags, ...catalog.moreTags]);
  const named = (list: Item[], slug: string) =>
    list.find((item) => item.slug === slug)?.name ?? slug;
  const chips = $derived([
    ...picked.systems.map((slug) => ({
      key: `system:${slug}`,
      name: named(systems, slug),
      remove: () => apply({ systems: picked.systems.filter((value) => value !== slug) }),
    })),
    ...picked.platforms.map((slug) => ({
      key: `platform:${slug}`,
      name: named(catalog.platforms, slug),
      remove: () => apply({ platforms: picked.platforms.filter((value) => value !== slug) }),
    })),
    ...picked.tags.map((slug) => ({
      key: `tag:${slug}`,
      name: named(allTags, slug),
      remove: () => apply({ tags: picked.tags.filter((value) => value !== slug) }),
    })),
  ]);
  const clearAll = () => apply({ systems: [], modality: null, platforms: [], tags: [] });

  let sheetOpen = $state(false);

  const segment =
    'inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold no-underline hover:preset-tonal';
  const trigger =
    'btn min-h-11 gap-2 rounded-lg border-2 border-surface-200-800 bg-panel px-4 font-semibold hover:preset-tonal';
</script>

{#snippet modality()}
  <div
    role="group"
    aria-label={m.tables_filter_modality()}
    class="inline-flex gap-1 rounded-lg border-2 border-surface-200-800 bg-panel p-1"
  >
    {#each modalities as option (option.value)}
      <button
        type="button"
        aria-pressed={option.value === picked.modality}
        class="{segment} {option.value === picked.modality ? 'preset-filled-primary-500' : ''}"
        onclick={() => apply({ modality: option.value })}
        >{#if option.value}<Icon
            name={modalityIcon(option.value)}
            size={18}
          />{/if}{option.label()}</button
      >
    {/each}
  </div>
{/snippet}

<div class="mt-5 grid gap-4 md:mt-8">
  <div class="flex flex-wrap items-end gap-3">
    {#if systems.length > 0}
      <div class="hidden w-72 md:block">
        <SearchSelect
          id="system-filter"
          name="system"
          label={m.tables_filter_label()}
          labelClass="label-text block pb-1 font-semibold"
          class="grid"
          items={systems}
          value={picked.systems}
          placeholder={m.tables_filter_search()}
          multiple
          showPicks={false}
          onchange={(next) => apply({ systems: next })}
        />
      </div>
    {/if}
    {@render modality()}
    {#each [{ kind: 'platforms', icon: 'category', label: m.form_platforms(), items: catalog.platforms }, { kind: 'tags', icon: 'tag', label: m.form_tags(), items: allTags }] as const as group (group.kind)}
      {#if group.items.length > 0}
        <div class="hidden w-60 md:block">
          <SearchSelect
            id="{group.kind}-filter"
            name={group.kind}
            label={group.label}
            labelClass="sr-only"
            class="grid"
            compact
            icon={group.icon}
            items={group.items}
            value={picked[group.kind]}
            placeholder={group.label}
            multiple
            summary
            showPicks={false}
            onchange={(next) => apply({ [group.kind]: next })}
          />
        </div>
      {/if}
    {/each}
    <button type="button" class="{trigger} md:hidden" onclick={() => (sheetOpen = true)}>
      {m.tables_filters_button()}
      {#if chips.length > 0}<span class="badge rounded-full preset-filled-primary-500 px-2"
          >{chips.length}</span
        >{/if}
    </button>
  </div>

  {#if chips.length > 0}
    <ul class="flex flex-wrap items-center gap-2" aria-label={m.tables_filters_active()}>
      {#each chips as chip (chip.key)}
        <li>
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-primary-500 px-4 text-sm font-semibold hover:preset-tonal"
            aria-label={m.tables_filter_remove({ name: chip.name })}
            onclick={chip.remove}
          >
            {chip.name}<Icon name="xmark" size={16} />
          </button>
        </li>
      {/each}
      <li>
        <button type="button" class="btn min-h-11 px-2 anchor font-semibold" onclick={clearAll}
          >{m.tables_filters_clear_all()}</button
        >
      </li>
    </ul>
  {/if}
</div>

<Dialog open={sheetOpen} onOpenChange={(details) => (sheetOpen = details.open)}>
  {#if sheetOpen}<Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/50" />
      <Dialog.Positioner class="fixed inset-0 z-50 md:hidden">
        <Dialog.Content class="flex size-full flex-col bg-surface-50-950">
          <header
            class="flex items-center justify-between gap-3 border-b border-surface-200-800 px-5 py-3"
          >
            <Dialog.Title class="text-xl font-semibold">{m.tables_filters_title()}</Dialog.Title>
            <Dialog.CloseTrigger
              class="btn size-11 rounded-lg p-0 hover:preset-tonal"
              aria-label={m.confirm_cancel()}><Icon name="xmark" size={20} /></Dialog.CloseTrigger
            >
          </header>
          <div class="grid flex-1 content-start gap-6 overflow-y-auto p-5">
            {#if systems.length > 0}
              <SearchSelect
                id="system-filter-sheet"
                name="system"
                label={m.tables_filter_label()}
                labelClass="label-text block pb-1 font-semibold"
                class="grid"
                items={systems}
                value={picked.systems}
                placeholder={m.tables_filter_search()}
                inDialog
                multiple
                onchange={(next) => apply({ systems: next })}
              />
            {/if}
            {#each [{ kind: 'platforms', icon: 'category', label: m.form_platforms(), items: catalog.platforms }, { kind: 'tags', icon: 'tag', label: m.form_tags(), items: allTags }] as const as group (group.kind)}
              {#if group.items.length > 0}
                <SearchSelect
                  id="{group.kind}-filter-sheet"
                  name={group.kind}
                  label={group.label}
                  labelClass="label-text block pb-1 font-semibold"
                  class="grid"
                  inDialog
                  icon={group.icon}
                  items={group.items}
                  value={picked[group.kind]}
                  placeholder={group.label}
                  multiple
                  onchange={(next) => apply({ [group.kind]: next })}
                />
              {/if}
            {/each}
          </div>
          <footer
            class="flex items-center justify-between gap-3 border-t border-surface-200-800 px-5 py-3"
          >
            <button type="button" class="btn min-h-11 px-0 anchor font-semibold" onclick={clearAll}
              >{m.tables_filters_clear_everything()}</button
            >
            <Dialog.CloseTrigger
              class="btn h-12 rounded-lg preset-filled-primary-500 px-5 font-semibold"
              >{m.tables_filter_show({ count })}</Dialog.CloseTrigger
            >
          </footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>{/if}
</Dialog>
