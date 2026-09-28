<script lang="ts">
  import SearchSelect from '$lib/components/SearchSelect.svelte';
  import TableCard from '$lib/components/TableCard.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  const locale = getLocale();
  const listHref = localizedHref('/tables', locale);

  /** The list's query string with the modality changed and every other filter kept. */
  const query = (modality: string | null) => {
    const parts = [
      ...data.pickedSystems.map((slug) => `system=${encodeURIComponent(slug)}`),
      modality ? `modality=${modality}` : '',
      ...data.pickedPlatforms.map((slug) => `platform=${encodeURIComponent(slug)}`),
      ...data.pickedTags.map((slug) => `tag=${encodeURIComponent(slug)}`),
    ].filter(Boolean);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  };

  const modalities = [
    { value: null, label: m.tables_filter_modality_all },
    { value: 'online', label: m.table_modality_online },
    { value: 'in_person', label: m.table_modality_in_person },
  ] as const;

  const count = $derived(
    data.tables.length === 1 ? m.tables_count_one() : m.tables_count({ count: data.tables.length }),
  );

  const chip =
    'inline-flex h-11 shrink-0 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold whitespace-nowrap no-underline';
  const chipIdle = `${chip} border-surface-200-800 bg-panel hover:preset-tonal`;
  const chipActive = `${chip} border-primary-500 preset-filled-primary-500`;
  // A ticked checkbox chip: the whole chip is its label; the box itself is hidden.
  const checkChip =
    'relative inline-flex h-11 shrink-0 cursor-pointer items-center rounded-lg border-[1.5px] border-surface-200-800 bg-panel px-4 text-sm font-semibold whitespace-nowrap hover:preset-tonal has-[:checked]:border-primary-500 has-[:checked]:preset-filled-primary-500 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-500';

  /** With JavaScript, ticking a chip applies it at once; without, the "Filtrar" button does. */
  const applyNow = (event: Event) =>
    (event.currentTarget as HTMLInputElement).form?.requestSubmit();
  let filterForm = $state<HTMLFormElement>();
  const rowLabel =
    'block pb-2 text-sm font-semibold text-muted md:w-20 md:shrink-0 md:pb-0 md:leading-11';
  const catalogGroups = $derived([
    {
      name: 'platform',
      id: 'platform-filter',
      label: m.form_platforms(),
      moreLabel: '',
      items: data.catalog.platforms,
      more: [],
      picked: data.pickedPlatforms,
    },
    {
      name: 'tag',
      id: 'tag-filter',
      label: m.form_tags(),
      moreLabel: m.tables_filter_more_tags(),
      items: data.catalog.tags,
      more: data.catalog.moreTags,
      picked: data.pickedTags,
    },
  ]);
</script>

<svelte:head>
  <title>{m.tables_title()}</title>
  <meta name="description" content={m.tables_description()} />
</svelte:head>

<section class="py-2 md:pt-12">
  <div class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
    <div>
      <h1 class="text-4xl leading-[1.05] font-semibold tracking-[-0.02em] text-balance md:text-7xl">
        {m.tables_title()}
      </h1>
      <p class="mt-2.5 max-w-[46ch] text-base text-muted md:mt-3.5 md:text-xl">
        {m.tables_lede()}
      </p>
    </div>
    <!-- On a phone the tab bar offers this once the platform is released; until then, the page does. -->
    <a
      href={localizedHref('/tables/new', locale)}
      class="btn h-13 shrink-0 gap-2.5 rounded-lg preset-filled-primary-500 px-6 font-semibold md:inline-flex {data.released
        ? 'hidden'
        : 'inline-flex'}"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"><path d="M12 5v14M5 12h14" /></svg
      >
      {m.tables_open_cta()}
    </a>
  </div>

  <!-- A plain GET form: it filters without JavaScript, and the URL can be shared. Every filter is a
	     slug in the query string, and a key repeats for each value ticked. -->
  <form
    bind:this={filterForm}
    method="GET"
    action={listHref}
    data-sveltekit-keepfocus
    data-sveltekit-noscroll
    class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 md:mt-8"
  >
    {#if data.modality}<input type="hidden" name="modality" value={data.modality} />{/if}
    {#if data.systems.length > 0}
      <SearchSelect
        id="system-filter"
        name="system"
        label={m.tables_filter_label()}
        labelClass={rowLabel}
        class="md:grid md:grid-cols-[88px_minmax(0,28rem)] md:items-start md:gap-x-5"
        items={data.systems}
        value={data.pickedSystems}
        placeholder={m.tables_filter_search()}
        multiple
        onchange={() => filterForm?.requestSubmit()}
      />
    {/if}
    <div role="group" aria-labelledby="modality-filter" class="md:flex md:items-start md:gap-5">
      <span id="modality-filter" class={rowLabel}>{m.tables_filter_modality()}</span>
      <div
        class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:gap-2.5 md:px-0"
      >
        {#each modalities as option (option.value)}
          <a
            href={localizedHref(`/tables${query(option.value)}`, locale)}
            aria-current={option.value === data.modality ? 'page' : undefined}
            class={option.value === data.modality ? chipActive : chipIdle}>{option.label()}</a
          >
        {/each}
      </div>
    </div>
    {#each catalogGroups as group (group.name)}
      {#if group.items.length > 0}
        <div role="group" aria-labelledby={group.id} class="md:flex md:items-start md:gap-5">
          <span id={group.id} class={rowLabel}>{group.label}</span>
          <div class="md:flex md:flex-wrap md:gap-2.5">
            <div class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:contents">
              {#each group.items as item (item.slug)}
                <label class={checkChip}>
                  <input
                    type="checkbox"
                    name={group.name}
                    value={item.slug}
                    checked={group.picked.includes(item.slug)}
                    onchange={applyNow}
                    class="sr-only"
                  />{item.name}
                </label>
              {/each}
            </div>
            {#if group.more.length > 0}
              <details class="group relative mt-2 md:mt-0">
                <summary
                  class="inline-flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg border-[1.5px] border-dashed border-surface-600-400 px-4 text-sm font-semibold whitespace-nowrap hover:preset-tonal [&::-webkit-details-marker]:hidden"
                  >{group.moreLabel}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    class="shrink-0 transition-transform group-open:rotate-180"
                    ><path d="M6 9l6 6 6-6" /></svg
                  ></summary
                >
                <div
                  class="mt-2 flex max-h-72 w-full flex-wrap gap-2 overflow-y-auto rounded-lg border border-surface-200-800 bg-panel p-3 shadow-xl md:absolute md:z-20 md:w-96"
                >
                  {#each group.more as item (item.slug)}
                    <label class={checkChip}>
                      <input
                        type="checkbox"
                        name={group.name}
                        value={item.slug}
                        onchange={applyNow}
                        class="sr-only"
                      />{item.name}
                    </label>
                  {/each}
                </div>
              </details>
            {/if}
          </div>
        </div>
      {/if}
    {/each}
    <noscript>
      <button
        type="submit"
        class="btn h-11 rounded-lg preset-filled-primary-500 px-5 font-semibold md:ml-27"
        >{m.tables_filter_apply()}</button
      >
    </noscript>
  </form>

  {#if data.tables.length > 0}
    <div class="mt-8 hidden items-baseline justify-between gap-6 md:flex">
      <p role="status" class="text-sm font-semibold text-muted">{count}</p>
      <p class="text-sm text-muted">{m.tables_filter_any_note()}</p>
    </div>
    <ul class="mt-5 grid grid-cols-1 gap-4 md:mt-3.5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
      {#each data.tables as table (table.slug)}
        <li><TableCard {table} /></li>
      {/each}
    </ul>
  {:else}
    <div class="mt-10 max-w-[44ch]" role="status">
      <p class="text-lg">
        {data.pickedSystems.length > 0 ||
        data.pickedPlatforms.length > 0 ||
        data.pickedTags.length > 0 ||
        data.modality
          ? m.tables_empty_filtered()
          : m.tables_empty()}
      </p>
      {#if data.pickedSystems.length > 0 || data.pickedPlatforms.length > 0 || data.pickedTags.length > 0 || data.modality}
        <a href={listHref} class="mt-3 inline-block anchor">{m.tables_filter_clear()}</a>
      {/if}
    </div>
  {/if}
</section>
