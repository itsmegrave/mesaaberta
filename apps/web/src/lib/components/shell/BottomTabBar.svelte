<script lang="ts">
  import Icon from '#lib/components/ui/Icon.svelte';
  import { page } from '$app/state';
  import ExploreSheet from '#lib/components/shell/ExploreSheet.svelte';
  import type { IconName } from '#lib/icons/names.js';
  import type { DirectoryLink } from '#lib/navigation/directory-nav.js';
  import { mainNav } from '#lib/navigation/main-nav.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    directories = [],
  }: {
    /** The directories that are on: one is linked straight, two or more open Explorar. */
    directories?: DirectoryLink[];
  } = $props();

  const pathname = $derived(page.url.pathname);
  // Every tab shows for everyone (the members' ones lead to sign-in). Admin is in the account menu.
  const links = mainNav('tabs', { signedIn: true });

  const tabClass = (current: boolean, primary = false) =>
    `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-center text-xs font-semibold no-underline ${
      primary || current ? 'text-surface-950-50' : 'text-muted hover:text-surface-950-50'
    }`;
  const exploring = $derived(directories.some((link) => link.current(pathname)));
</script>

{#snippet face(icon: IconName, label: string, current: boolean, primary = false)}
  <span
    class="relative flex h-7 w-14 items-center justify-center rounded-full {primary
      ? `preset-filled-primary-500 ${current ? 'ring-2 ring-warning-500' : ''}`
      : current
        ? 'bg-surface-200-800'
        : 'bg-transparent'}"
  >
    <Icon name={icon} size={22} />
  </span>
  {label}
{/snippet}

<nav
  aria-label={m.nav_mobile()}
  class="fixed inset-x-0 bottom-0 z-40 flex h-20 items-center justify-around border-t border-surface-200-800 bg-panel px-2 pb-1 md:hidden"
>
  {#each links as link (link.href)}
    {@const current = link.current(pathname)}
    <a
      href={link.href}
      aria-label={link.tabAriaLabel?.()}
      aria-current={current ? 'page' : undefined}
      class={tabClass(current, link.primary)}
    >
      {@render face(link.icon, link.tabLabel(), current, link.primary)}
    </a>
  {/each}
  {#if directories.length === 1}
    {@const only = directories[0]}
    <a href={only.href} aria-current={exploring ? 'page' : undefined} class={tabClass(exploring)}>
      {@render face(only.icon, only.shortLabel(), exploring)}
    </a>
  {:else if directories.length > 1}
    <ExploreSheet
      links={directories}
      {pathname}
      triggerClass="{tabClass(exploring)} cursor-pointer"
    >
      {#snippet trigger()}{@render face(
          'game-icons:treasure-map',
          m.nav_explore(),
          exploring,
        )}{/snippet}
    </ExploreSheet>
  {/if}
</nav>
