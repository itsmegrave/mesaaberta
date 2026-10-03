<script lang="ts">
  // The page numbers under a list: previous, the first, the last and the ones around the current
  // (with "…" where numbers are left out), next. Plain links, so every page has an address.
  import Icon from '$lib/components/Icon.svelte';
  import { pageWindow } from '$lib/admin/list';
  import { m } from '$lib/paraglide/messages';

  let {
    page,
    pages,
    href,
  }: {
    page: number;
    pages: number;
    /** The address of a page, already localized, keeping the list's filters. */
    href: (page: number) => string;
  } = $props();

  const numbers = $derived(pageWindow(page, pages));
  const box =
    'inline-flex size-10 items-center justify-center rounded-lg text-sm font-semibold tabular-nums no-underline';
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the hrefs arrive already localized -->
{#if pages > 1}
  <nav aria-label={m.admin_pagination()} class="flex flex-wrap items-center gap-1">
    {#if page > 1}
      <a
        class="{box} hover:preset-tonal"
        href={href(page - 1)}
        rel="prev"
        aria-label={m.admin_profile_previous()}
        title={m.admin_profile_previous()}><Icon name="chevron-left" size={18} /></a
      >
    {:else}
      <span class="{box} opacity-40" aria-hidden="true"><Icon name="chevron-left" size={18} /></span
      >
    {/if}
    {#each numbers as number, index (number ?? `gap-${index}`)}
      {#if number === null}
        <span class="{box} text-muted" aria-hidden="true">…</span>
      {:else}
        <a
          class="{box} {number === page ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
          href={href(number)}
          aria-current={number === page ? 'page' : undefined}
          aria-label={m.admin_pager_page({ page: number })}>{number}</a
        >
      {/if}
    {/each}
    {#if page < pages}
      <a
        class="{box} hover:preset-tonal"
        href={href(page + 1)}
        rel="next"
        aria-label={m.admin_profile_next()}
        title={m.admin_profile_next()}><Icon name="chevron-right" size={18} /></a
      >
    {:else}
      <span class="{box} opacity-40" aria-hidden="true"
        ><Icon name="chevron-right" size={18} /></span
      >
    {/if}
  </nav>
{/if}
