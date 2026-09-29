<script lang="ts">
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  type Crumb = { label: string; href?: string };

  /**
   * Where an inner page sits, from the home page down: pass the levels after "Início"; the last is
   * the current page (text, `aria-current`). Wide screens only: on a phone the page keeps its
   * "← Voltar" link, as a trail does not fit a narrow bar.
   */
  let { items, class: className = '' }: { items: Crumb[]; class?: string } = $props();

  const locale = getLocale();
  const trail = $derived([{ label: m.breadcrumbs_home(), href: '/' }, ...items]);
</script>

<nav aria-label={m.breadcrumbs_label()} class="hidden md:block {className}">
  <ol class="flex flex-wrap items-center gap-2 text-sm text-muted">
    {#each trail as crumb, index (index)}
      <li class="flex min-w-0 items-center gap-2">
        {#if index > 0}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            class="shrink-0"><path d="M9 6l6 6-6 6" /></svg
          >
        {/if}
        {#if index === trail.length - 1}
          <span aria-current="page" class="truncate font-semibold text-surface-950-50"
            >{crumb.label}</span
          >
        {:else if crumb.href}
          <a href={localizedHref(crumb.href, locale)} class="truncate link-underline"
            >{crumb.label}</a
          >
        {:else}
          <span class="truncate">{crumb.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
