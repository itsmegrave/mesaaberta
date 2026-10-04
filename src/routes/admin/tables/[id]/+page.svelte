<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import AuditTimeline from '$lib/components/admin/AuditTimeline.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import UserLink from '$lib/components/UserLink.svelte';
  import { dayLabel, timeLabel } from '$lib/admin/format';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const locale = getLocale();
  const table = $derived(data.table);
  const card = 'rounded-lg border border-surface-200-800 bg-panel p-5';
</script>

<svelte:head
  ><title>{m.admin_table_page_title({ title: table.title })} | Mesa Aberta</title></svelte:head
>
<AdminPage
  title={table.title}
  eyebrow={m.admin_tables()}
  lede={m.admin_table_page_lede()}
  crumbs={[
    { label: m.nav_admin(), href: '/admin' },
    { label: m.admin_tables(), href: '/admin/tables' },
    { label: table.title },
  ]}
  menu={[
    {
      id: 'public',
      label: m.admin_table_open_public(),
      icon: 'eye',
      href: localizedHref(`/tables/${table.slug}`, locale),
    },
  ]}
>
  <section aria-labelledby="table-summary" class={card}>
    <h2 id="table-summary" class="sr-only">{m.admin_table_page_title({ title: table.title })}</h2>
    <dl class="divide-y divide-surface-200-800">
      <div class="grid gap-1 py-3 sm:grid-cols-2">
        <dt class="text-sm font-semibold text-muted">{m.admin_table_gm()}</dt>
        <dd class="text-sm"><UserLink username={table.gm} label={`@${table.gm}`} /></dd>
      </div>
      <div class="grid gap-1 py-3 sm:grid-cols-2">
        <dt class="text-sm font-semibold text-muted">{m.admin_table_session()}</dt>
        <dd class="text-sm">
          {dayLabel(table.startsAt, locale, table.timezone)} · {timeLabel(
            table.startsAt,
            locale,
            table.timezone,
          )}
        </dd>
      </div>
      <div class="grid gap-1 py-3 sm:grid-cols-2">
        <dt class="text-sm font-semibold text-muted">{m.admin_table_status()}</dt>
        <dd><StatusBadge status={`table:${table.status}` as Status} /></dd>
      </div>
    </dl>
  </section>

  <section aria-labelledby="table-history" class="mt-8 {card}">
    <h2 id="table-history" class="text-lg font-semibold">{m.history_title()}</h2>
    <AuditTimeline history={data.history} zone={data.viewer.timezone} />
  </section>
</AdminPage>
