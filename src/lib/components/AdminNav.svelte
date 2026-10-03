<script lang="ts">
  // The admin's sections in groups, with what waits on an admin counted beside them. A column on a
  // desktop; on a phone one "Seção: …" button that opens the same list as a menu.
  import { goto } from '$app/navigation';
  import { Menu, Portal } from '@skeletonlabs/skeleton-svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let {
    route,
    counts,
  }: {
    /** The route id of the page, to mark its section. */
    route: string | null;
    counts: { reports: number; queue: number; connections: number };
  } = $props();

  const locale = getLocale();
  // The path of the connections stays `/admin/instagram`: Meta's OAuth redirect URI points at its callback.
  const groups = $derived([
    {
      key: 'overview',
      label: m.admin_group_overview(),
      sections: [{ path: '/admin', label: m.admin_nav_overview() }],
    },
    {
      key: 'moderation',
      label: m.admin_group_moderation(),
      sections: [
        { path: '/admin/reports', label: m.admin_reports_title(), count: counts.reports },
        { path: '/admin/queue', label: m.admin_nav_queue(), count: counts.queue },
      ],
    },
    {
      key: 'content',
      label: m.admin_group_content(),
      sections: [
        { path: '/admin/tables', label: m.admin_tables() },
        { path: '/admin/users', label: m.admin_profile_list() },
        { path: '/admin/catalog', label: m.admin_nav_catalog() },
      ],
    },
    {
      key: 'communication',
      label: m.admin_group_communication(),
      sections: [
        { path: '/admin/notifications', label: m.admin_nav_notifications() },
        { path: '/admin/instagram', label: m.admin_nav_connections(), count: counts.connections },
      ],
    },
    {
      key: 'log',
      label: m.admin_group_log(),
      sections: [{ path: '/admin/audit', label: m.admin_audit_title() }],
    },
  ]);
  const all = $derived(groups.flatMap((group) => group.sections));
  const isCurrent = (path: string) =>
    path === '/admin' ? route === '/admin' : !!route?.startsWith(path);
  const current = $derived(all.find((section) => isCurrent(section.path)));

  // The menu is built when it opens: a closed one would put an inline `style` on the page, which
  // the CSP refuses.
  let open = $state(false);
</script>

{#snippet badge(value: number | undefined)}
  {#if value}
    <span
      class="ml-auto badge min-w-6 rounded-full preset-filled-error-500 px-1 text-xs font-bold tabular-nums"
      >{value > 99 ? '99+' : value}</span
    >
  {/if}
{/snippet}

<nav
  aria-label={m.admin_nav_label()}
  class="sticky top-6 hidden w-59 shrink-0 gap-5 self-start md:grid"
>
  {#each groups as group (group.key)}
    <div class="grid gap-1">
      <p class="px-3 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p>
      <ul class="grid gap-1">
        {#each group.sections as section (section.path)}
          <li>
            <a
              href={localizedHref(section.path, locale)}
              aria-current={isCurrent(section.path) ? 'page' : undefined}
              class="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold no-underline hover:preset-tonal aria-[current=page]:bg-surface-200-800"
              >{section.label}{@render badge('count' in section ? section.count : undefined)}</a
            >
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>

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
      <span>{m.admin_section({ name: current?.label ?? m.admin_nav_overview() })}</span>
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
                  aria-current={isCurrent(section.path) ? 'page' : undefined}
                  class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold aria-[current=page]:bg-surface-200-800 data-highlighted:preset-tonal"
                >
                  {section.label}{@render badge('count' in section ? section.count : undefined)}
                </Menu.Item>
              {/each}
            {/each}
          </Menu.Content>
        </Menu.Positioner>
      </Portal>{/if}
  </Menu>
</div>
