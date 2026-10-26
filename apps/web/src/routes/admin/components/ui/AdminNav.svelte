<script lang="ts">
  import CountBadge from '#lib/components/ui/CountBadge.svelte';
  // The admin's sections as a column beside the content, in groups, with what waits on an admin
  // counted beside them. Phones have no column: the page head holds the "Seção: …" menu instead.
  import Icon from '#lib/components/ui/Icon.svelte';
  import {
    adminGroups,
    sectionOf,
    type AdminCounts,
    type ExtensionSection,
  } from '#lib/admin/sections.js';
  import { m } from '#lib/paraglide/messages.js';

  let {
    route,
    path,
    counts,
    connectionsPath,
    sections = [],
    badges = false,
  }: {
    /** The route id of the page, to mark its section. */
    route: string | null;
    /** The page's path, which tells apart the extensions' sections (they share one route). */
    path?: string;
    counts: AdminCounts;
    /** The connections page, when an installed extension has a panel on it. */
    connectionsPath: string | null;
    /** The installed extensions' own sections. */
    sections?: readonly ExtensionSection[];
    /** Whether the badges section is listed (`use_badges`). */
    badges?: boolean;
  } = $props();

  const groups = $derived(adminGroups(counts, connectionsPath, sections, { badges }));
  const current = $derived(sectionOf(groups, route, path));
</script>

<!-- 236px wide (59 × 4px) and sticky at the top of the content. The 20px above it centres
     "Visão geral" on the breadcrumbs row of the page beside it. -->
<nav
  aria-label={m.admin_nav_label()}
  class="sticky top-5 mt-5 hidden w-59 shrink-0 gap-5 self-start md:grid"
>
  {#each groups as group (group.key)}
    <div class="grid gap-1">
      <!-- "Visão geral" is its own only section: the layout shows the link, not a heading over it. -->
      {#if group.sections.length > 1 || group.sections[0]?.label !== group.label}
        <p class="px-3 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p>
      {/if}
      <ul class="grid gap-1">
        {#each group.sections as section (section.path)}
          {@const here = current?.path === section.path}
          <li class="relative">
            <a
              href={section.path}
              aria-current={here ? 'page' : undefined}
              class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline hover:bg-surface-wash aria-[current=page]:bg-surface-wash"
            >
              <Icon name={section.icon} size={20} class="shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate">{section.label}</span>
              <CountBadge
                count={section.count ?? 0}
                max={99}
                tone={section.alert ? 'error' : 'warning'}
                class="min-w-6 px-1"
              />
            </a>
            {#if here}
              <!-- The bar of the current section, on the left edge of its item. -->
              <span
                aria-hidden="true"
                class="absolute inset-y-2 left-0 w-0.75 rounded-full bg-primary-500"
              ></span>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>
