<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { page } from '$app/state';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { isAdmin = false }: { isAdmin?: boolean } = $props();

  const locale = getLocale();
  const pathname = $derived(page.url.pathname);

  const isTablesActive = $derived(pathname.startsWith('/tables') && pathname !== '/tables/new');
  const isNewTableActive = $derived(pathname === '/tables/new');
  const isMyTablesActive = $derived(pathname.startsWith('/account'));
  const isAdminActive = $derived(pathname.startsWith('/admin'));
</script>

<nav
  aria-label={m.nav_mobile()}
  class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-surface-200-800 bg-panel px-2 pb-1 md:hidden"
>
  <!-- Mesas -->
  <a
    href={localizedHref('/tables', locale)}
    class="flex h-14 min-w-21 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline {isTablesActive
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full {isTablesActive
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      >
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="7" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
        <rect x="13" y="13" width="7" height="7" rx="2" />
      </svg>
    </span>
    {m.nav_tables()}
  </a>

  <!-- Abrir mesa -->
  <a
    href={localizedHref('/tables/new', locale)}
    class="flex h-14 min-w-21 flex-col items-center justify-center gap-1 text-xs font-semibold text-surface-950-50 no-underline"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full preset-filled-primary-500 {isNewTableActive
        ? 'ring-2 ring-warning-500'
        : ''}"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    </span>
    {m.nav_open_table_short()}
  </a>

  <!-- Minhas mesas -->
  <a
    href={localizedHref('/account/tables', locale)}
    class="flex h-14 min-w-21 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline {isMyTablesActive
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full {isMyTablesActive
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
    >
      <Icon name="game-icons:tabletop-players" size={22} />
    </span>
    {m.nav_my_tables()}
  </a>

  <!-- Admin (only if admin) -->
  {#if isAdmin}
    <a
      href={localizedHref('/admin', locale)}
      class="flex h-14 min-w-21 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline {isAdminActive
        ? 'text-surface-950-50'
        : 'text-muted hover:text-surface-950-50'}"
    >
      <span
        class="flex h-7 w-14 items-center justify-center rounded-full {isAdminActive
          ? 'bg-surface-200-800'
          : 'bg-transparent'}"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          class="shrink-0"
        >
          <path d="M12 3l7 3v5.5c0 4.5-3 7.5-7 9.5-4-2-7-5-7-9.5V6l7-3z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </span>
      {m.nav_admin()}
    </a>
  {/if}
</nav>
