<script lang="ts">
  import Spinner from '$lib/components/Spinner.svelte';
  import Button from '$lib/components/Button.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons/names';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import QueryStatus from '$lib/components/QueryStatus.svelte';
  import { pageQuery } from '$lib/query/page.svelte';
  import { localizedHref } from '$lib/i18n/locales';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data: serverData } = $props();
  const remote = pageQuery(() => serverData);
  const data = $derived({ ...serverData, ...remote.data });
  const locale = getLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const date = (value: Date) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: serverData.viewer.timezone,
    }).format(value);
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
      title: m.admin_pending(),
      rows: [
        [m.admin_platform_suggestions(), data.suggestions.platforms],
        [m.admin_tag_suggestions(), data.suggestions.tags],
        [m.admin_events_pending(), data.queue.pending],
        [m.admin_events_failed(), data.queue.failed],
      ],
    },
  ]);
</script>

<svelte:head><title>{m.admin_overview_title()} | Mesa Aberta</title></svelte:head>

<section class="py-6 md:py-10">
  <Breadcrumbs items={[{ label: m.nav_admin() }]} class="mb-6" />
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-semibold">{m.admin_overview_title()}</h1>
      <p class="mt-2 text-sm text-muted">{m.admin_updated({ time: date(data.updatedAt) })}</p>
    </div>
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
  </div>
  <QueryStatus failed={remote.isError} retry={() => remote.refetch()} />

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

  <div class="mt-10 grid gap-8 border-y border-surface-200-800 py-8 md:grid-cols-3">
    {#each groups as group (group.title)}
      <section>
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

  <a class="mt-6 inline-flex min-h-11 items-center gap-2 anchor" href={localizedHref('/', locale)}
    ><Icon name="external-link" size={18} />{m.admin_view_platform()}</a
  >
</section>
