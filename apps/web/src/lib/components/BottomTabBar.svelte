<script lang="ts">
  import CountBadge from '#lib/components/ui/CountBadge.svelte';
  import Icon from '#lib/components/Icon.svelte';
  import { page } from '$app/state';
  import { mainNav, type MainNavLink } from '#lib/navigation/main-nav.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    isAdmin = false,
    pendingSuggestionsCount = 0,
  }: {
    /** Admins get a fifth tab. Parceiros has no tab. */
    isAdmin?: boolean;
    /** Suggestions waiting for an admin, shown on the Admin tab. */
    pendingSuggestionsCount?: number;
  } = $props();

  const pathname = $derived(page.url.pathname);
  // Every tab shows for everyone (the members' ones lead to sign-in), plus Admin for admins.
  const links = $derived(mainNav('tabs', { signedIn: true, isAdmin }));
</script>

{#snippet tab(link: MainNavLink)}
  {@const current = link.current(pathname)}
  {@const admin = link.audience === 'admins'}
  <a
    href={link.href}
    aria-label={admin
      ? pendingSuggestionsCount > 0
        ? `${m.nav_admin()}: ${pendingSuggestionsCount}`
        : undefined
      : link.tabAriaLabel?.()}
    aria-current={admin && current ? 'page' : undefined}
    class="relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline {link.primary ||
    current
      ? 'text-surface-950-50'
      : 'text-muted hover:text-surface-950-50'}"
  >
    <span
      class="relative flex h-7 w-14 items-center justify-center rounded-full {link.primary
        ? `preset-filled-primary-500 ${current ? 'ring-2 ring-warning-500' : ''}`
        : current
          ? 'bg-surface-200-800'
          : 'bg-transparent'}"
    >
      <Icon name={link.icon} size={22} />
      {#if admin}
        <CountBadge
          count={pendingSuggestionsCount}
          aria-hidden="true"
          class="absolute -top-1 right-1 h-4 min-w-4 px-1"
        />
      {/if}
    </span>
    {link.tabLabel()}
  </a>
{/snippet}

<nav
  aria-label={m.nav_mobile()}
  class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-surface-200-800 bg-panel px-2 pb-1 md:hidden"
>
  {#each links as link (link.href)}
    {@render tab(link)}
  {/each}
</nav>
