<script lang="ts">
  import { page } from '$app/state';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { children } = $props();

  const locale = getLocale();
  // Each admin section adds its link here.
  const sections = [
    { path: '/admin', label: m.admin_nav_overview(), short: m.admin_short_overview() },
    { path: '/admin/tables', label: m.admin_tables(), short: m.admin_short_tables() },
    { path: '/admin/users', label: m.admin_profile_list(), short: m.admin_short_users() },
    { path: '/admin/reports', label: m.admin_reports_title(), short: m.admin_short_reports() },
    { path: '/admin/queue', label: m.admin_nav_queue(), short: m.admin_short_queue() },
    { path: '/admin/catalog', label: m.admin_nav_catalog(), short: m.admin_short_catalog() },
    {
      path: '/admin/notifications',
      label: m.admin_nav_notifications(),
      short: m.admin_short_notifications(),
    },
    // The path stays `/admin/instagram`: Meta's OAuth redirect URI points at its callback.
    {
      path: '/admin/instagram',
      label: m.admin_nav_connections(),
      short: m.admin_short_connections(),
    },
    { path: '/admin/audit', label: m.admin_audit_title(), short: m.admin_short_audit() },
  ];
</script>

<div class="pt-2 md:pt-12">
  <p class="text-sm font-semibold tracking-wide text-muted uppercase">{m.admin_title()}</p>
  <nav aria-label={m.admin_nav_label()} class="mt-3 border-b border-surface-200-800">
    <ul class="flex flex-wrap gap-x-1">
      {#each sections as section (section.path)}
        {@const current =
          section.path === '/admin'
            ? page.route.id === '/admin'
            : page.route.id?.startsWith(section.path)}
        <li>
          <a
            href={localizedHref(section.path, locale)}
            aria-current={current ? 'page' : undefined}
            class="inline-flex h-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap focus-visible:-outline-offset-2 {current
              ? 'border-primary-500'
              : 'border-transparent text-muted hover:text-inherit'}"
            ><span class="sm:hidden">{section.short}</span><span class="max-sm:hidden"
              >{section.label}</span
            ></a
          >
        </li>
      {/each}
    </ul>
  </nav>
  {@render children()}
</div>
