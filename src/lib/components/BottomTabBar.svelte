<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { page } from '$app/state';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  const locale = getLocale();
  const pathname = $derived(page.url.pathname);

  const isTablesActive = $derived(pathname.startsWith('/tables') && pathname !== '/tables/new');
  const isCrowdfundingActive = $derived(pathname.startsWith('/crowdfunding'));
  const isNewTableActive = $derived(pathname === '/tables/new');
  // Only the tables' own pages: the profile and the rest of the account are not "Minhas mesas".
  const isMyTablesActive = $derived(pathname.startsWith('/account/tables'));
  const isPartnersActive = $derived(pathname.startsWith('/partners'));
</script>

<nav
  aria-label={m.nav_mobile()}
  class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-surface-200-800 bg-panel px-2 pb-1 md:hidden"
>
  <!-- Mesas -->
  <a
    href={localizedHref('/tables', locale)}
    class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {isTablesActive
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full {isTablesActive
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
    >
      <Icon name="game-icons:tavern-sign" size={22} />
    </span>
    {m.nav_tables()}
  </a>

  <!-- Financiamentos coletivos: the short label fits the bar, the full name is what is announced -->
  <a
    href={localizedHref('/crowdfunding', locale)}
    aria-label={m.nav_crowdfunding_label()}
    class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {isCrowdfundingActive
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full {isCrowdfundingActive
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
    >
      <Icon name="game-icons:open-treasure-chest" size={22} />
    </span>
    {m.nav_crowdfunding_short()}
  </a>

  <!-- Parceiros -->
  <a
    href={localizedHref('/partners', locale)}
    class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {isPartnersActive
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full {isPartnersActive
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
    >
      <Icon name="game-icons:trade" size={22} />
    </span>
    {m.partner_nav_label()}
  </a>

  <!-- Abrir mesa -->
  <a
    href={localizedHref('/tables/new', locale)}
    class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold text-surface-950-50 no-underline"
  >
    <span
      class="flex h-7 w-14 items-center justify-center rounded-full preset-filled-primary-500 {isNewTableActive
        ? 'ring-2 ring-warning-500'
        : ''}"
    >
      <Icon name="game-icons:dice-twenty-faces-twenty" size={22} />
    </span>
    {m.nav_open_table_short()}
  </a>

  <!-- Minhas mesas -->
  <a
    href={localizedHref('/account/tables', locale)}
    class="flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {isMyTablesActive
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
</nav>
