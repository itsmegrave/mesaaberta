<script lang="ts">
  import { page } from '$app/state';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { children } = $props();

  const locale = getLocale();
  // Each admin section adds its link here.
  const sections = [
    { path: '/admin', label: m.admin_nav_overview() },
    { path: '/admin/tables', label: m.admin_tables() },
    { path: '/admin/users', label: m.admin_profile_list() },
    { path: '/admin/reports', label: m.admin_reports_title() },
    { path: '/admin/queue', label: m.admin_nav_queue() },
    { path: '/admin/catalog', label: m.admin_nav_catalog() },
    { path: '/admin/notifications', label: m.admin_nav_notifications() },
    // The path stays `/admin/instagram`: Meta's OAuth redirect URI points at its callback.
    { path: '/admin/instagram', label: m.admin_nav_connections() },
    { path: '/admin/audit', label: m.admin_audit_title() },
  ];
</script>

<div class="pt-2 md:pt-12">
  <p class="text-sm font-semibold tracking-wide text-muted uppercase">{m.admin_title()}</p>
  <nav aria-label={m.admin_nav_label()} class="mt-3 border-b border-surface-200-800">
    <ul class="flex gap-1 overflow-x-auto overflow-y-hidden">
      {#each sections as section (section.path)}
        {@const current =
          section.path === '/admin'
            ? page.route.id === '/admin'
            : page.route.id?.startsWith(section.path)}
        <li class="shrink-0">
          <a
            href={localizedHref(section.path, locale)}
            aria-current={current ? 'page' : undefined}
            class="inline-flex h-11 items-center border-b-2 px-3 font-semibold whitespace-nowrap focus-visible:-outline-offset-2 {current
              ? 'border-primary-500'
              : 'border-transparent text-muted hover:text-inherit'}">{section.label}</a
          >
        </li>
      {/each}
    </ul>
  </nav>
  {@render children()}
</div>
