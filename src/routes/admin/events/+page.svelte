<script lang="ts">
  import { page } from '$app/state';
  import AdminPage from '$lib/components/admin/AdminPage.svelte';
  import EventForce from '$lib/components/admin/EventForce.svelte';
  import EventRetryAll from '$lib/components/admin/EventRetryAll.svelte';
  import FilterSelect from '$lib/components/admin/FilterSelect.svelte';
  import Pager from '$lib/components/admin/Pager.svelte';
  import SegmentedFilter from '$lib/components/admin/SegmentedFilter.svelte';
  import { dayLabel, timeLabel } from '$lib/admin/format';
  import { EVENT_STATUSES, type EventStatus } from '$lib/admin/event-filters';
  import { listPath, listQuery, pageRange } from '$lib/admin/list';
  import { localizedHref } from '$lib/i18n/locales';
  import { atHandle } from '$lib/profile/handle';
  import { m } from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';

  let { data } = $props();
  const locale = getLocale();
  const zone = $derived(data.viewer.timezone);
  const queue = $derived(data.queue);

  const statusLabel = (status: EventStatus) =>
    ({
      failed: m.admin_events_status_failed,
      retrying: m.admin_events_status_retrying,
      pending: m.admin_events_status_pending,
      running: m.admin_events_status_running,
      processed: m.admin_events_status_processed,
    })[status]();
  const statuses = $derived(
    EVENT_STATUSES.map((value) => ({
      value,
      label: statusLabel(value),
      count: queue.counts[value],
    })),
  );
  const types = $derived([
    { slug: '', name: m.admin_events_type_all() },
    ...queue.types.map((type) => ({ slug: type, name: type })),
  ]);
  const when = (value: Date) =>
    `${dayLabel(value, locale, zone)}, ${timeLabel(value, locale, zone)}`;
  const range = $derived(pageRange(queue.page, queue.pageSize, queue.total));
  const pageLink = (next: number) =>
    localizedHref(
      listPath(page.url.pathname, listQuery(page.url.searchParams, { page: next })),
      locale,
    );
  const list = (handlers: string[]) =>
    handlers.length ? handlers.join(', ') : m.admin_events_no_handlers();
  const canForce = (status: EventStatus) => status !== 'processed' && status !== 'running';
</script>

<svelte:head><title>{m.admin_events_title()} | Mesa Aberta</title></svelte:head>

<AdminPage title={m.admin_events_title()} lede={m.admin_events_lede()}>
  {#if queue.status === 'failed' && queue.counts.failed > 0}
    <div class="mt-6"><EventRetryAll max={25} /></div>
  {/if}

  <section
    aria-label={m.admin_events_title()}
    class="mt-6 rounded-lg border border-surface-200-800 bg-panel"
  >
    <div class="grid gap-3 border-b border-surface-200-800 p-4">
      <div class="flex flex-wrap items-center gap-3">
        <FilterSelect
          id="event-type"
          name="type"
          label={m.admin_events_type()}
          options={types}
          value={queue.type}
          fallback=""
        />
        <p role="status" class="ml-auto text-sm font-semibold text-muted">
          {m.admin_events_total({ count: queue.total })}
        </p>
      </div>
      <SegmentedFilter
        name="status"
        label={m.admin_events_status()}
        options={statuses}
        value={queue.status}
        fallback="failed"
      />
    </div>

    {#if queue.rows.length === 0}
      <p class="p-6 text-center text-muted" role="status">
        {queue.type ? m.admin_events_filtered_empty() : m.admin_events_empty()}
      </p>
    {:else}
      <ol class="divide-y divide-surface-200-800">
        {#each queue.rows as row (row.id)}
          <li class="grid gap-2 p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-semibold wrap-break-word">{row.type}</p>
                <p class="text-sm text-muted">
                  <time datetime={row.createdAt.toISOString()}
                    >{m.admin_events_created({ date: when(row.createdAt) })}</time
                  >
                  · {row.actor ? atHandle(row.actor) : m.history_system()}
                </p>
              </div>
              {#if canForce(queue.status)}<EventForce id={row.id} type={row.type} />{/if}
            </div>
            <p class="text-sm tabular-nums">
              {m.admin_events_attempts({ attempts: row.attempts, max: queue.maxAttempts })}
              {#if row.failedAt}
                · {m.admin_events_failed_at({ date: when(row.failedAt) })}
              {:else if row.processedAt}
                · {m.admin_events_processed_at({ date: when(row.processedAt) })}
              {:else if queue.status === 'retrying'}
                · {m.admin_events_next({ date: when(row.nextAttemptAt) })}
              {/if}
            </p>
            {#if row.lastError && !row.processedAt}
              <p class="text-sm wrap-break-word">
                <span class="font-semibold">{m.admin_events_last_error()}:</span>
                <span class="font-mono text-xs">{row.lastError}</span>
              </p>
            {/if}
            <p class="text-sm text-muted">
              {m.admin_events_done({ handlers: list(row.handledBy) })}
              {#if !row.processedAt}
                · {m.admin_events_left({ handlers: list(row.remaining) })}
              {/if}
            </p>
            <details class="text-sm">
              <summary class="inline-flex min-h-11 cursor-pointer items-center anchor font-semibold"
                >{m.admin_events_payload()}</summary
              >
              <pre
                class="mt-1 overflow-x-auto rounded-lg bg-surface-wash p-3 text-xs">{JSON.stringify(
                  row.payload,
                  null,
                  2,
                )}</pre>
            </details>
          </li>
        {/each}
      </ol>
    {/if}

    <div
      class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-200-800 px-4 py-3"
    >
      <p class="text-sm text-muted" aria-live="polite">
        {#if queue.total > 0}{m.admin_list_range({
            from: range.from,
            to: range.to,
            total: m.admin_events_total({ count: queue.total }),
          })}{/if}
      </p>
      <Pager page={queue.page} pages={queue.pages} href={pageLink} />
    </div>
  </section>
</AdminPage>
