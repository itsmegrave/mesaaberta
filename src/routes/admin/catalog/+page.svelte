<script lang="ts">
  import AdminPageHead from '$lib/components/AdminPageHead.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import TextInput from '$lib/components/TextInput.svelte';
  import Form from '$lib/components/Form.svelte';
  import Button from '$lib/components/Button.svelte';
  import UserText from '$lib/components/UserText.svelte';
  import KebabMenu, { type KebabItem } from '$lib/components/KebabMenu.svelte';
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
  const menuOf = (row: Row): KebabItem[] => [
    {
      id: 'rename',
      label: m.admin_queue_rename(),
      icon: 'square-pen',
      onselect: () => (chosen = { mode: 'rename', row }),
    },
    {
      id: 'merge',
      label: m.admin_catalog_menu_merge(),
      icon: 'routing',
      onselect: () => (chosen = { mode: 'merge', row }),
    },
    ...(row.status === 'approved'
      ? [
          {
            id: 'disable',
            label: m.admin_catalog_menu_disable(),
            icon: 'trash' as const,
            destructive: true,
            onselect: () => (chosen = { mode: 'disable', row }),
          },
        ]
      : []),
  ];
  const ghost =
    'btn h-12 rounded-lg border-2 border-surface-200-800 px-4 font-semibold hover:preset-tonal';
  const tab = '-mb-px inline-flex h-11 items-center border-b-2 px-3 font-semibold';
</script>

<svelte:head><title>{m.admin_catalog_title()}</title></svelte:head>

<section class="pt-8 pb-4">
  <Breadcrumbs
    items={[{ label: m.nav_admin(), href: '/admin' }, { label: m.admin_catalog_title() }]}
    class="mb-6"
  />
  <AdminPageHead title={m.admin_catalog_title()} lede={m.admin_catalog_lede()} />

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
    <Form
      method="GET"
      action={localizedHref('/admin/catalog', locale)}
      class="flex items-end gap-3"
    >
      <input type="hidden" name="kind" value={data.kind} />
      <div class="grid gap-1">
        <label for="catalog-search" class="label-text font-semibold"
          >{m.admin_catalog_search()}</label
        >
        <TextInput
          id="catalog-search"
          name="q"
          type="search"
          value={data.query}
          maxlength={40}
          class="input h-12 rounded-lg border-surface-200-800 px-3"
        />
      </div>
      <Button size="custom" type="submit" class={ghost}>{m.admin_catalog_search_apply()}</Button>
    </Form>
    <!-- A different catalog needs new defaults; refetches within the same kind preserve drafts. -->
    {#key data.kind}
      <CatalogDialog
        mode="create"
        kind={data.kind}
        label={data.kind === 'platform'
          ? m.admin_catalog_new_platform()
          : m.admin_catalog_new_tag()}
        triggerClass="btn h-12 rounded-lg preset-filled-primary-500 px-4 font-semibold"
      />
    {/key}
  </div>

  {#if data.rows.length === 0}
    <p class="mt-6 rounded-lg border border-surface-200-800 bg-panel p-6" role="status">
      {m.admin_catalog_empty()}
    </p>
  {:else}
    <div class="mt-6 rounded-lg border border-surface-200-800">
      <table class="w-full text-left max-md:block">
        <thead class="border-b border-surface-200-800 text-sm text-muted max-md:sr-only">
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
        <tbody class="max-md:block">
          {#each data.rows as row (row.id)}
            <tr
              class="border-b border-surface-200-800 last:border-b-0 max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-between max-md:gap-x-3 max-md:px-2 max-md:py-3"
            >
              <th scope="row" class="px-4 py-3 font-semibold max-md:basis-full max-md:py-1">
                {row.name}
                <span class="block text-sm font-normal text-muted">{row.slug}</span>
              </th>
              <td class="px-4 py-3">
                {#if row.suggestedBy}<UserText
                    text={m.admin_catalog_origin_suggestion({ username: row.suggestedBy })}
                    username={row.suggestedBy}
                  />{:else}{m.admin_catalog_origin_catalog()}{/if}
              </td>
              <td class="px-4 py-3 text-right tabular-nums">{number.format(row.uses)}</td>
              <td class="px-4 py-3">{status(row)}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end">
                  <KebabMenu name={row.name} items={menuOf(row)} />
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
