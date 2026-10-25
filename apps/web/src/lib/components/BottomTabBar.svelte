<script lang="ts">
  import Icon from '#lib/components/Icon.svelte';
  import { page } from '$app/state';
  import { m } from '#lib/paraglide/messages.js';

  const pathname = $derived(page.url.pathname);

  const isTablesActive = $derived(
    (pathname === '/t' || pathname.startsWith('/t/')) && pathname !== '/t/new',
  );
  const isCrowdfundingActive = $derived(pathname === '/cf' || pathname.startsWith('/cf/'));
  const isNewTableActive = $derived(pathname === '/t/new');
  // Only the tables' own pages: the profile and the rest of the account are not "Minhas mesas".
  const isMyTablesActive = $derived(pathname === '/u/tables' || pathname.startsWith('/u/tables/'));
  const isAdminActive = $derived(pathname === '/admin' || pathname.startsWith('/admin/'));

  let {
    isAdmin = false,
    pendingSuggestionsCount = 0,
  }: {
    /** Admins get a fifth tab. Parceiros has no tab. */
    isAdmin?: boolean;
    /** Suggestions waiting for an admin, shown on the Admin tab. */
    pendingSuggestionsCount?: number;
  } = $props();
</script>

<nav
  aria-label={m.nav_mobile()}
  class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-surface-200-800 bg-panel px-2 pb-1 md:hidden"
>
  <!-- Mesas -->
  <a
    href="/t"
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
    href="/cf"
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

  <!-- Abrir mesa -->
  <a
    href="/t/new"
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
    href="/u/tables"
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

  {#if isAdmin}
    <a
      href="/admin"
      aria-label={pendingSuggestionsCount > 0
        ? `${m.nav_admin()}: ${pendingSuggestionsCount}`
        : undefined}
      aria-current={isAdminActive ? 'page' : undefined}
      class="relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {isAdminActive
        ? 'text-surface-950-50'
        : 'text-muted hover:text-surface-950-50'}"
    >
      <span
        class="relative flex h-7 w-14 items-center justify-center rounded-full {isAdminActive
          ? 'bg-surface-200-800'
          : 'bg-transparent'}"
      >
        <Icon name="game-icons:black-knight-helm" size={22} />
        {#if pendingSuggestionsCount > 0}
          <span
            aria-hidden="true"
            class="absolute -top-1 right-1 badge h-4 min-w-4 rounded-full preset-filled-warning-500 px-1 text-xs font-bold"
          >
            {pendingSuggestionsCount > 9 ? '9+' : pendingSuggestionsCount}
          </span>
        {/if}
      </span>
      {m.nav_admin()}
    </a>
  {/if}
</nav>
