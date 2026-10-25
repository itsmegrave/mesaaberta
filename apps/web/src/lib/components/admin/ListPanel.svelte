<script lang="ts">
  // The bordered card of an admin list: the toolbar on top, the rows, and a footer with "1–20 de N"
  // and the page numbers. DataTable's desktop table sits in it, and so do the lists that are not a
  // table (the events, the audit log).
  import type { Snippet } from 'svelte';
  import { page as current } from '$app/state';
  import Pager from '#lib/components/admin/Pager.svelte';
  import { listPath, listQuery, pageRange } from '@mesaaberta/core/admin/list';
  import { m } from '#lib/paraglide/messages.js';

  let {
    as = 'section',
    label,
    class: className = '',
    toolbar,
    total,
    totalLabel,
    page,
    pageSize,
    pages: knownPages,
    pageHref = (next) =>
      listPath(current.url.pathname, listQuery(current.url.searchParams, { page: next })),
    empty,
    filtered = false,
    clearHref,
    footer,
    children,
  }: {
    as?: 'section' | 'div';
    /** The list's name for assistive technology. */
    label?: string;
    class?: string;
    /** The search, selects and segments; the panel draws the border under them. */
    toolbar?: Snippet;
    total: number;
    /** "9 mesas": the count the footer says. */
    totalLabel: string;
    page: number;
    pageSize: number;
    pages?: number;
    /** The address of a page, keeping the list's filters; the first has no parameter. */
    pageHref?: (page: number) => string;
    /** Shown instead of the rows when there are none. A table leaves it out: it says so in a row. */
    empty?: string;
    /** Whether any filter is on: the empty state then offers "Limpar filtros". */
    filtered?: boolean;
    /** Where "Limpar filtros" goes; the list without any parameter unless it says otherwise. */
    clearHref?: string;
    /** Beside the page numbers: the "Por página" choice. */
    footer?: Snippet;
    children: Snippet;
  } = $props();

  const pages = $derived(knownPages ?? Math.max(1, Math.ceil(total / pageSize)));
  const range = $derived(pageRange(page, pageSize, total));
</script>

<svelte:element
  this={as}
  aria-label={label}
  class="rounded-lg border border-surface-200-800 bg-panel {className}"
>
  {#if toolbar}
    <div class="grid grid-cols-1 gap-3 border-b border-surface-200-800 p-4">
      {@render toolbar()}
    </div>
  {/if}

  {#if empty !== undefined && total === 0}
    <p class="p-6 text-center text-muted" role="status">{empty}</p>
    {#if filtered}
      <p class="pb-6 text-center">
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- already canonical -->
        <a
          class="inline-flex min-h-11 items-center anchor font-semibold"
          href={clearHref ?? current.url.pathname}>{m.admin_list_clear()}</a
        >
      </p>
    {/if}
  {:else}
    {@render children()}
  {/if}

  <div
    class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-200-800 px-4 py-3"
  >
    <!-- A panel with its own empty state says so above; a table keeps "0 mesas" here. -->
    <p class="text-sm text-muted" aria-live="polite">
      {#if total > 0}{m.admin_list_range({
          from: range.from,
          to: range.to,
          total: totalLabel,
        })}{:else if empty === undefined}{totalLabel}{/if}
    </p>
    <div class="flex flex-wrap items-center gap-4">
      {@render footer?.()}
      <Pager {page} {pages} href={pageHref} />
    </div>
  </div>
</svelte:element>
