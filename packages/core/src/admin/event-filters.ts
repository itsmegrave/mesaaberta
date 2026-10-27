import '@mesaaberta/core/forms/zod-codes';
import { z } from 'zod';
import { pageNumber } from '@mesaaberta/core/admin/catalog';
import { pageSizeOf } from '@mesaaberta/core/admin/list';
import {
  EVENT_REVIEWS,
  EVENT_STATUSES,
  type EventReview,
  type EventStatus,
} from '@mesaaberta/core/admin/event-status';

export { EVENT_REVIEWS, EVENT_STATUSES, type EventReview, type EventStatus };

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
/** An admin's word on a given-up event: seen, ignored or fixed. */
export const reviewSchema = z.object({ id: z.uuid(), review: z.enum(EVENT_REVIEWS) });
