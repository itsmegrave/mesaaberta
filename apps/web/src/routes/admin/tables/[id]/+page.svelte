<script lang="ts">
  import AdminPage from '#lib/components/admin/AdminPage.svelte';
  import AuditTimeline from '../../components/ui/AuditTimeline.svelte';
  import DetailList from '#lib/components/ui/DetailList.svelte';
  import DetailRow from '#lib/components/ui/DetailRow.svelte';
  import Panel from '#lib/components/ui/Panel.svelte';
  import StatusBadge, { type Status } from '#lib/components/ui/StatusBadge.svelte';
  import UserLink from '#lib/components/ui/UserLink.svelte';
  import { dayLabel, timeLabel } from '#lib/admin/format.js';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { data } = $props();
  const locale = getLocale();
  const table = $derived(data.table);
</script>

<AdminPage
  title={table.title}
  tabTitle={`${m.admin_table_page_title({ title: table.title })} | Mesa Aberta`}
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
      href: `/t/${table.slug}`,
    },
  ]}
>
  <Panel
    title={m.admin_table_page_title({ title: table.title })}
    titleClass="sr-only"
    class="mt-6 p-4 md:p-5"
  >
    <DetailList>
      <DetailRow label={m.admin_table_gm()} class="text-sm"
        ><UserLink username={table.gm} label={`@${table.gm}`} /></DetailRow
      >
      <DetailRow label={m.admin_table_session()} class="text-sm">
        {dayLabel(table.startsAt, locale, table.timezone)} · {timeLabel(
          table.startsAt,
          locale,
          table.timezone,
        )}
      </DetailRow>
      <DetailRow label={m.admin_table_status()}
        ><StatusBadge status={`table:${table.status}` as Status} /></DetailRow
      >
    </DetailList>
  </Panel>

  <Panel title={m.history_title()} class="mt-6 p-4 md:p-5">
    <AuditTimeline history={data.history} zone={data.viewer.timezone} />
  </Panel>
</AdminPage>
