import type { EventType, StoredEvent } from '../events/types';
import type { AnalyticsEvent } from './provider';

export const PRODUCT_EVENTS = [
  'TableCreated',
  'TableUpdated',
  'TableDisabled',
  'JoinRequested',
  'JoinApproved',
  'JoinDeclined',
  'PlayerJoined',
  'PlayerLeft',
  'RatingSubmitted',
] as const satisfies readonly EventType[];

const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/**
 * The privacy filter every provider shares: only allowlisted event types with an actor and event
 * UUID, carrying opaque ids and the original time. Nothing else leaves the system.
 */
export function toAnalyticsEvent(event: StoredEvent): AnalyticsEvent | null {
  if (
    !(PRODUCT_EVENTS as readonly string[]).includes(event.type) ||
    !uuid(event.actorId) ||
    !uuid(event.id)
  )
    return null;
  const tableId = 'tableId' in event.payload ? event.payload.tableId : null;
  return {
    name: event.type,
    distinctId: event.actorId,
    insertId: event.id,
    time: event.createdAt,
    properties: uuid(tableId) ? { tableId } : {},
  };
}
