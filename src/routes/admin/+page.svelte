<script lang="ts">
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import Media from '$lib/components/admin/Media.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import Spinner from '$lib/components/Spinner.svelte';
  import StatusBadge, { type Status } from '$lib/components/StatusBadge.svelte';
  import { dayLabel, shortDate, timeLabel } from '$lib/admin/format';
  import type { IconName } from '$lib/icons/names';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { pageQuery } from '$lib/query/page.svelte';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const locale = getLocale();
  const zone = $derived(serverData.viewer.timezone);
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const updated = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: zone,
    }).format(value);
  type Recent = (typeof data.recent)[number];

  const metrics = $derived([
    {
      label: m.admin_profiles(),
      value: data.people.total,
      icon: 'game-icons:meeple',
      detail: m.admin_new_profiles({ count: number(data.people.new30d) }),
    },
    {
      label: m.admin_tables(),
      value: data.tables.total,
      icon: 'game-icons:tavern-sign',
      detail:
        data.tables.total > 0 && data.tables.active === data.tables.total
          ? m.admin_tables_all_active()
          : m.admin_active_tables({ count: number(data.tables.active) }),
    },
    {
      label: m.admin_gms(),
      value: data.tables.gms,
      icon: 'flag',
      detail: m.admin_gms_scope(),
    },
    {
      label: m.admin_confirmed(),
      value: data.seats.confirmed,
      icon: 'game-icons:meeple',
      detail: m.admin_pending_seats({ count: number(data.seats.pending) }),
    },
  ]);
  const groups = $derived([
    {
      title: m.admin_community(),
      rows: [
        [m.admin_active_profiles(), data.people.active],
        [m.admin_suspended(), data.people.suspended],
        [m.admin_banned(), data.people.banned],
      ],
    },
    {
      title: m.admin_tables(),
      rows: [
        [m.admin_active(), data.tables.active],
        [m.admin_awaiting_confirmation(), data.tables.awaiting],
        [m.admin_concluded(), data.tables.concluded],
        [m.admin_not_held(), data.tables.notHeld],
        [m.admin_disabled(), data.tables.disabled],
        [m.admin_online(), data.tables.online],
        [m.admin_in_person(), data.tables.inPerson],
      ],
    },
    {
      title: m.admin_operations(),
      rows: [
        [m.admin_platform_suggestions(), data.suggestions.platforms],
        [m.admin_tag_suggestions(), data.suggestions.tags],
        [m.admin_events_pending(), data.queue.pending],
        [m.admin_events_failed(), data.queue.failed],
      ],
    },
  ]);

  // What waits on an admin, each with the one thing worth saying about it. A section with nothing
  // waiting is not listed.
  type Attention = {
    id: string;
    icon: IconName;
    title: string;
    count: number;
    detail: string;
    href: string;
  };
  const attention = $derived.by(() => {
    const { reports, posts, awaiting, suggestions } = data.attention;
    const found: Attention[] = [];
    const waitingReports = serverData.adminCounts?.reports ?? 0;
    if (reports.oldestAt)
      found.push({
        id: 'reports',
        icon: 'flag',
        title: m.admin_attention_reports(),
        count: waitingReports,
        detail: m.admin_attention_reports_detail({
          date: shortDate(reports.oldestAt, locale, zone),
        }),
        href: '/admin/reports',
      });
    if (posts.count > 0)
      found.push({
        id: 'posts',
        icon: 'globe',
        title: m.admin_attention_posts(),
        count: posts.count,
        detail: m.admin_attention_posts_detail({ title: posts.first ?? '' }),
        href: '/admin/tables?instagram=uncertain',
      });
    if (awaiting.count > 0 && awaiting.first)
      found.push({
        id: 'awaiting',
        icon: 'clock',
        title: m.admin_attention_awaiting(),
        count: awaiting.count,
        detail: m.admin_attention_awaiting_detail({
          title: awaiting.first.title,
          date: shortDate(awaiting.first.startsAt, locale, awaiting.first.timezone),
        }),
        href: '/admin/tables?status=awaiting_confirmation',
      });
    const waitingSuggestions = suggestions.platforms + suggestions.tags;
    if (waitingSuggestions > 0)
      found.push({
        id: 'suggestions',
        icon: 'check',
        title: m.admin_attention_suggestions(),
        count: waitingSuggestions,
        detail: [
          m.admin_attention_suggestions_detail({
            platforms: suggestions.platforms,
            tags: suggestions.tags,
          }),
          suggestions.duplicates > 0
            ? m.admin_attention_duplicates({ count: suggestions.duplicates })
            : null,
        ]
          .filter(Boolean)
          .join(' · '),
        href: '/admin/queue',
      });
    return found;
  });
  const href = (path: string) => localizedHref(path, locale);
</script>

<svelte:head><title>{m.admin_nav_overview()} | Mesa Aberta</title></svelte:head>

<AdminPage
  title={m.admin_nav_overview()}
  lede={m.admin_updated({ time: updated(data.updatedAt) })}
  crumbs={[{ label: m.nav_admin() }]}
  menu={[
    {
      id: 'platform',
      label: m.admin_view_platform(),
      icon: 'external-link',
      href: href('/'),
    },
  ]}
>
  {#snippet actions()}
    <Button
      size="custom"
      type="button"
      class="btn h-11 gap-2 rounded-lg preset-tonal-primary px-4"
      disabled={remote.isFetching}
      onclick={() => remote.refetch()}
    >
      {#if remote.isFetching}<Spinner />{:else}<Icon name="refresh-cw" size={18} />{/if}
      {m.admin_refresh()}
    </Button>
  {/snippet}
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

  <section aria-labelledby="attention-title" class="mt-8">
    <h2 id="attention-title" class="text-lg font-semibold">{m.admin_attention_title()}</h2>
    {#if attention.length === 0}
      <p class="mt-3 rounded-lg border border-surface-200-800 bg-panel p-5 text-muted">
        {m.admin_attention_none()}
      </p>
    {:else}
      <ul
        class="mt-3 divide-y divide-surface-200-800 rounded-lg border border-surface-200-800 bg-panel"
      >
        {#each attention as item (item.id)}
          <li>
            <a
              href={href(item.href)}
              class="flex min-h-17 items-center gap-3 px-4 py-3 hover:bg-surface-wash"
            >
              <Media kind="icon" icon={item.icon} />
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{item.title}</span>
                <span class="block truncate text-sm text-muted">{item.detail}</span>
              </span>
              <span
                class="chip rounded-full preset-filled-warning-500 px-2.5 font-semibold tabular-nums"
                >{number(item.count)}</span
              >
              <Icon name="chevron-right" size={18} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <dl class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {#each metrics as metric (metric.label)}
      <div class="rounded-lg border border-surface-200-800 bg-panel p-5">
        <dt class="flex items-center gap-2 text-sm font-semibold text-muted">
          <Icon name={metric.icon as IconName} size={18} />{metric.label}
        </dt>
        <dd class="mt-3 text-3xl font-semibold tabular-nums">{number(metric.value)}</dd>
        <dd class="mt-2 text-sm text-muted">{metric.detail}</dd>
      </div>
    {/each}
  </dl>

  <div class="mt-8 grid gap-4 md:grid-cols-3">
    {#each groups as group (group.title)}
      <section class="rounded-lg border border-surface-200-800 bg-panel p-5">
        <h2 class="text-lg font-semibold">{group.title}</h2>
        <dl class="mt-4 space-y-3">
          {#each group.rows as [label, value] (label)}
            <div class="flex items-baseline justify-between gap-4">
              <dt class="text-sm">{label}</dt>
              <dd class="font-semibold tabular-nums">{number(Number(value))}</dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>

  <section aria-labelledby="recent-title" class="mt-8">
    <div class="flex items-baseline justify-between gap-3">
      <h2 id="recent-title" class="text-lg font-semibold">{m.admin_recent_title()}</h2>
      <a class="inline-flex min-h-11 items-center anchor font-semibold" href={href('/admin/tables')}
        >{m.admin_recent_all()}</a
      >
    </div>
    <ul
      class="mt-2 divide-y divide-surface-200-800 rounded-lg border border-surface-200-800 bg-panel"
    >
      {#each data.recent as row (row.id)}
        {@render recentRow(row)}
      {:else}
        <li class="p-5 text-muted">{m.admin_tables_empty()}</li>
      {/each}
    </ul>
  </section>
</AdminPage>

{#snippet recentRow(row: Recent)}
  <li class="flex min-h-17 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
    <Media kind="cover" src={row.cover} />
    <div class="min-w-0 flex-1 basis-48">
      <a class="block truncate link-underline" href={href(`/tables/${row.slug}`)}>{row.title}</a>
      <p class="truncate text-sm text-muted">
        {m.admin_tables_gm_of({ system: row.system, gm: `@${row.gm}` })}
      </p>
    </div>
    <p class="w-40 text-sm">
      <span class="font-semibold">{dayLabel(row.startsAt, locale, row.timezone)}</span>
      <span class="block text-muted">{timeLabel(row.startsAt, locale, row.timezone)}</span>
    </p>
    <StatusBadge status={`table:${row.status}` as Status} />
  </li>
{/snippet}
