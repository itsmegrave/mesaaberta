import '$lib/forms/zod-codes';
import { z } from 'zod';
import { pageNumber } from './catalog';
import { pageSizeOf } from './list';

/**
 * Where an event stands in the queue. `failed` (given up on) is what needs a person, so it is the
 * tab the page opens on.
 */
export const EVENT_STATUSES = ['failed', 'retrying', 'pending', 'running', 'processed'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_PAGE_SIZE = 20;

export function eventFilters(params: URLSearchParams) {
  const status = params.get('status');
  const type = (params.get('type') ?? '').trim().slice(0, 60);
  return {
    status: (EVENT_STATUSES as readonly string[]).includes(status ?? '')
      ? (status as EventStatus)
      : ('failed' as const),
    // `''` is every type; the page checks the rest against the types the queue has.
    type,
    page: pageNumber(params.get('page')),
    pageSize: pageSizeOf(params, EVENT_PAGE_SIZE),
  };
}

/** "Run it now" for one event. The "run all" form carries nothing. */
export const forceSchema = z.object({ id: z.uuid() });
export const retryAllSchema = z.object({});
