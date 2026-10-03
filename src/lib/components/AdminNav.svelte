<script lang="ts">
  // The admin's sections as a column beside the content, in groups, with what waits on an admin
  // counted beside them. Phones have no column: the page head holds the "Seção: …" menu instead.
  import Icon from '$lib/components/Icon.svelte';
  import { adminGroups, sectionOf, type AdminCounts } from '$lib/admin/sections';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let {
    route,
    counts,
  }: {
    /** The route id of the page, to mark its section. */
    route: string | null;
    counts: AdminCounts;
  } = $props();

  const locale = getLocale();
  const groups = $derived(adminGroups(counts));
  const current = $derived(sectionOf(groups, route));
</script>

<!-- 236px wide (59 × 4px) and sticky at the top of the content. -->
<nav
  aria-label={m.admin_nav_label()}
  class="sticky top-6 hidden w-59 shrink-0 gap-5 self-start md:grid"
>
  {#each groups as group (group.key)}
    <div class="grid gap-1">
      <p class="px-3 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p>
      <ul class="grid gap-1">
        {#each group.sections as section (section.path)}
          {@const here = current?.path === section.path}
          <li class="relative">
            <a
              href={localizedHref(section.path, locale)}
              aria-current={here ? 'page' : undefined}
              class="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold no-underline hover:bg-surface-wash aria-[current=page]:bg-surface-wash"
            >
              <Icon name={section.icon} size={20} class="shrink-0 text-muted" />
              <span class="min-w-0 flex-1 truncate">{section.label}</span>
              {#if section.count}
                <span
                  class="badge min-w-6 rounded-full preset-filled-warning-500 px-1 text-xs font-bold tabular-nums"
                  >{section.count > 99 ? '99+' : section.count}</span
                >
              {/if}
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
