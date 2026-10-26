<script lang="ts">
  import Icon from '#lib/components/ui/Icon.svelte';
  import { page } from '$app/state';
  import { mainNav, type MainNavLink } from '#lib/navigation/main-nav.js';
  import { m } from '#lib/paraglide/messages.js';

  const pathname = $derived(page.url.pathname);
  // Every tab shows for everyone (the members' ones lead to sign-in). Admin is in the account menu.
  const links = mainNav('tabs', { signedIn: true });
</script>

{#snippet tab(link: MainNavLink)}
  {@const current = link.current(pathname)}
  <a
    href={link.href}
    aria-label={link.tabAriaLabel?.()}
    aria-current={current ? 'page' : undefined}
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
