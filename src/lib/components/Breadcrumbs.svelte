<script lang="ts">
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';

  type Crumb = { label: string; href?: string };

  /**
   * Where a page sits, from the home page down: pass the levels after "Início"; the last is the
   * current page (text, `aria-current`). Every page but the home page shows one, on every screen
   * size. On a phone a trail over three levels folds its middle into a "…" menu, so it never wraps
   * or scrolls sideways; middle links truncate at 150px and the current page keeps at least 72px.
   */
  let { items, class: className = '' }: { items: Crumb[]; class?: string } = $props();

  const locale = getLocale();
  const trail = $derived([{ label: m.breadcrumbs_home(), href: '/' }, ...items]);
  const folds = $derived(trail.length > 3);
  const hidden = $derived(trail.slice(1, -1));
  const current = $derived(trail[trail.length - 1]);

  // A menu item's value is the crumb's link, already localized.
  const open = (href: string) =>
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- already resolved by localizedHref
    goto(href);
</script>

{#snippet separator()}
  <Icon name="chevron-right" size={16} class="text-muted" />
{/snippet}

{#snippet home()}
  <a
    href={localizedHref('/', locale)}
    class="inline-flex min-h-11 items-center gap-1 link-underline md:min-h-0"
  >
    <Icon name="game-icons:house" size={16} />{trail[0].label}
  </a>
{/snippet}

{#snippet here()}
  <span aria-current="page" class="block min-w-18 truncate font-semibold text-surface-950-50"
    >{current.label}</span
  >
{/snippet}

<nav aria-label={m.breadcrumbs_label()} class="min-w-0 {className}">
  <!-- Every level, from tablets up (and on a phone while the trail has three levels or fewer). -->
  <ol class="{folds ? 'hidden md:flex' : 'flex'} items-center gap-2 text-sm text-muted">
    {#each trail as crumb, index (index)}
      <li class="flex min-w-0 items-center gap-2">
        {#if index > 0}{@render separator()}{/if}
        {#if index === 0}
          {@render home()}
        {:else if index === trail.length - 1}
          {@render here()}
        {:else if crumb.href}
          <a
            href={localizedHref(crumb.href, locale)}
            class="block max-w-37.5 truncate link-underline">{crumb.label}</a
          >
        {:else}
          <span class="block max-w-37.5 truncate">{crumb.label}</span>
        {/if}
      </li>
    {/each}
  </ol>

  {#if folds}
    <ol class="flex items-center gap-2 text-sm text-muted md:hidden">
      <li class="flex items-center gap-2">{@render home()}</li>
      <li class="flex items-center gap-2">
        {@render separator()}
        <Menu
          positioning={{ placement: 'bottom-start', offset: { mainAxis: 4 } }}
          onSelect={({ value }) => open(value)}
        >
          <Menu.Trigger
            aria-label={m.breadcrumbs_more()}
            class="btn inline-flex size-11 items-center justify-center rounded-lg p-0 hover:preset-tonal"
          >
            <span aria-hidden="true">…</span>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner class="z-50!">
              <Menu.Content
                class="w-64 card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
              >
                {#each hidden as crumb (crumb.label)}
                  {#if crumb.href}
                    <Menu.Item
                      value={localizedHref(crumb.href, locale)}
                      class="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold hover:preset-tonal"
                    >
                      <span class="truncate">{crumb.label}</span>
                    </Menu.Item>
                  {/if}
                {/each}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu>
      </li>
      <li class="flex min-w-0 items-center gap-2">{@render separator()}{@render here()}</li>
    </ol>
  {/if}
</nav>
