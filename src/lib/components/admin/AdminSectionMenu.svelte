<script lang="ts">
  // On a phone the sections are one full-width button, "Seção: Mesas", with what waits on an admin
  // in total, that opens the same groups and counts as a menu.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { adminGroups, sectionOf } from '$lib/admin/sections';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  const locale = getLocale();
  const counts = $derived(page.data.adminCounts ?? { reports: 0, queue: 0, connections: 0 });
  const groups = $derived(adminGroups(counts));
  const current = $derived(sectionOf(groups, page.route.id));
  const waiting = $derived(counts.reports + counts.queue + counts.connections);

  // The menu is built when it opens: a closed one would put an inline `style` on the page, which
  // the CSP refuses.
  let open = $state(false);
</script>

{#snippet badge(value: number | undefined)}
  {#if value}
    <span
      class="badge min-w-6 rounded-full preset-filled-warning-500 px-1 text-xs font-bold tabular-nums"
      >{value > 99 ? '99+' : value}</span
    >
  {/if}
{/snippet}

<div class="md:hidden">
  <Menu
    {open}
    onOpenChange={(details) => (open = details.open)}
    positioning={{ placement: 'bottom-start', sameWidth: true, offset: { mainAxis: 4 } }}
    onSelect={({ value }) => void goto(localizedHref(value, locale))}
  >
    <Menu.Trigger
      class="btn flex h-12 w-full items-center justify-between gap-2 rounded-lg border-2 border-surface-200-800 bg-panel px-4 font-semibold"
    >
      <span class="min-w-0 flex-1 truncate text-left"
        >{m.admin_section({ name: current?.label ?? m.admin_nav_overview() })}</span
      >
      {@render badge(waiting)}
      <Icon name="chevron-down" size={18} />
    </Menu.Trigger>
    {#if open}<Portal>
        <Menu.Positioner class="z-50!">
          <Menu.Content
            aria-label={m.admin_nav_label()}
            class="card border border-surface-200-800 bg-surface-100-900 p-2 shadow-2xl"
          >
            {#each groups as group (group.key)}
              <p class="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                {group.label}
              </p>
              {#each group.sections as section (section.path)}
                <Menu.Item
                  value={section.path}
                  aria-current={current?.path === section.path ? 'page' : undefined}
                  class="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold aria-[current=page]:bg-surface-wash data-highlighted:preset-tonal"
                >
                  <Icon name={section.icon} size={20} class="shrink-0 text-muted" />
                  <span class="min-w-0 flex-1 truncate">{section.label}</span>
                  {@render badge(section.count)}
                </Menu.Item>
              {/each}
            {/each}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>{/if}
  </Menu>
</div>
