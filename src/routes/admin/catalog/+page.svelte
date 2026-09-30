<script lang="ts">
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import CatalogDialog from '$lib/components/admin/CatalogDialog.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();

  const locale = getLocale();
  const number = new Intl.NumberFormat(locale);
  type Row = (typeof data.rows)[number];

  const status = (row: Row) =>
    ({
      approved: m.admin_catalog_status_approved,
      pending: m.admin_catalog_status_pending,
      disabled: m.admin_catalog_status_disabled,
      rejected: m.admin_catalog_status_disabled,
    })[row.status]();
  const href = (params: Record<string, string | number | null>) => {
    const query = new SvelteURLSearchParams();
    query.set('kind', data.kind);
    if (data.query) query.set('q', data.query);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) query.delete(key);
      else query.set(key, String(value));
    }
    return localizedHref(`/admin/catalog?${query}`, locale);
  };
  const pageHref = (page: number) => href({ page: page === 1 ? null : page });

  // The row menu only picks; the dialog is mounted next to the table, so closing the menu does not
  // take it away.
  let chosen = $state<{ mode: 'merge' | 'disable' | 'rename'; row: Row } | null>(null);
  let menuOpen = $state<string | null>(null);
  const ghost =
    'btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
  const item =
    'btn flex h-12 w-full items-center justify-start rounded-lg px-3 text-left font-semibold hover:preset-tonal';
  const tab = '-mb-px inline-flex h-11 items-center border-b-2 px-3 font-semibold';
</script>

<svelte:head><title>{m.admin_catalog_title()}</title></svelte:head>

<section class="pt-8 pb-4">
  <h1 class="text-4xl leading-none font-semibold tracking-tight text-balance md:text-6xl">
    {m.admin_catalog_title()}
  </h1>
  <p class="mt-4 max-w-2xl text-lg">{m.admin_catalog_lede()}</p>

  <nav aria-label={m.admin_catalog_title()} class="mt-8 border-b border-surface-200-800">
    <ul class="flex gap-1">
      {#each [['platform', m.admin_catalog_tab_platforms()], ['tag', m.admin_catalog_tab_tags()]] as const as [kind, label] (kind)}
        <li>
          <a
            href={localizedHref(`/admin/catalog?kind=${kind}`, locale)}
            aria-current={data.kind === kind ? 'page' : undefined}
            class="{tab} {data.kind === kind
              ? 'border-primary-500'
              : 'border-transparent text-muted hover:text-inherit'}">{label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>

  <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
    <form
      method="GET"
      action={localizedHref('/admin/catalog', locale)}
      class="flex items-end gap-3"
    >
      <input type="hidden" name="kind" value={data.kind} />
      <div class="grid gap-1">
        <label for="catalog-search" class="label-text font-semibold"
          >{m.admin_catalog_search()}</label
        >
        <input
          id="catalog-search"
          name="q"
          type="search"
          value={data.query}
          maxlength="40"
          class="input h-12 rounded-lg border-surface-200-800 px-3"
        />
      </div>
      <button type="submit" class={ghost}>{m.admin_catalog_search_apply()}</button>
    </form>
    <CatalogDialog
      mode="create"
      kind={data.kind}
      label={data.kind === 'platform' ? m.admin_catalog_new_platform() : m.admin_catalog_new_tag()}
      triggerClass="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
    />
  </div>

  {#if data.rows.length === 0}
    <p class="mt-6 rounded-lg border border-surface-200-800 bg-panel p-6" role="status">
      {m.admin_catalog_empty()}
    </p>
  {:else}
    <div class="mt-6 overflow-x-auto rounded-lg border border-surface-200-800">
      <table class="w-full min-w-176 text-left">
        <thead class="border-b border-surface-200-800 text-sm text-muted">
          <tr>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_catalog_name()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_catalog_origin()}</th>
            <th scope="col" class="px-4 py-3 text-right font-semibold">{m.admin_catalog_uses()}</th>
            <th scope="col" class="px-4 py-3 font-semibold">{m.admin_catalog_status()}</th>
            <th scope="col" class="px-4 py-3 text-right font-semibold"
              >{m.admin_catalog_actions()}</th
            >
          </tr>
        </thead>
        <tbody>
          {#each data.rows as row (row.id)}
            <tr class="border-b border-surface-200-800 last:border-b-0">
              <th scope="row" class="px-4 py-3 font-semibold">
                {row.name}
                <span class="block text-sm font-normal text-muted">{row.slug}</span>
              </th>
              <td class="px-4 py-3">
                {row.suggestedBy
                  ? m.admin_catalog_origin_suggestion({ username: row.suggestedBy })
                  : m.admin_catalog_origin_catalog()}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">{number.format(row.uses)}</td>
              <td class="px-4 py-3">{status(row)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="btn h-12 rounded-lg px-3 font-semibold hover:preset-tonal"
                    aria-label="{m.admin_queue_rename()}: {row.name}"
                    onclick={() => (chosen = { mode: 'rename', row })}
                    >{m.admin_queue_rename()}</button
                  >
                  <Popover
                    open={menuOpen === row.id}
                    onOpenChange={(details) => (menuOpen = details.open ? row.id : null)}
                    positioning={{ placement: 'bottom-end', offset: { mainAxis: 4 } }}
                  >
                    <Popover.Trigger
                      aria-label={m.admin_catalog_more({ name: row.name })}
                      class="btn size-12 rounded-lg p-0 hover:preset-tonal"
                      ><Icon name="chevron-down" size={18} /></Popover.Trigger
                    >
                    <Popover.Positioner class="z-40!">
                      <Popover.Content
                        class="w-48 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
                      >
                        <button
                          type="button"
                          class={item}
                          onclick={() => {
                            menuOpen = null;
                            chosen = { mode: 'merge', row };
                          }}>{m.admin_queue_merge()}</button
                        >
                        {#if row.status === 'approved'}
                          <button
                            type="button"
                            class="{item} text-error-700-300"
                            onclick={() => {
                              menuOpen = null;
                              chosen = { mode: 'disable', row };
                            }}>{m.admin_catalog_disable()}</button
                          >
                        {/if}
                      </Popover.Content>
                    </Popover.Positioner>
                  </Popover>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <nav
      aria-label={m.admin_catalog_pages_label()}
      class="mt-4 flex items-center justify-between gap-3"
    >
      <p class="text-sm text-muted" aria-live="polite">
        {m.admin_catalog_page({ page: data.page, pages: data.pages })}
      </p>
      <div class="flex gap-2">
        {#if data.page > 1}
          <a href={pageHref(data.page - 1)} rel="prev" class={ghost}
            ><Icon name="chevron-left" size={18} />{m.admin_catalog_prev()}</a
          >
        {/if}
        {#if data.page < data.pages}
          <a href={pageHref(data.page + 1)} rel="next" class={ghost}
            >{m.admin_catalog_next()}<Icon name="chevron-right" size={18} /></a
          >
        {/if}
      </div>
    </nav>
  {/if}

  {#if chosen}
    {#key `${chosen.mode}-${chosen.row.id}`}
      <CatalogDialog
        mode={chosen.mode}
        kind={data.kind}
        entry={chosen.row}
        candidates={data.approved}
        startOpen
        onclose={() => (chosen = null)}
      />
    {/key}
  {/if}
</section>
