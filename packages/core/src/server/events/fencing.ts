import type { AnyDb } from '../db/client';

/**
 * Whether owner-fenced leases are on for the work that uses a database connection. The request's
 * flag (`api_events_fenced_leases`, targeted at admins first) is read lazily and only when an event
 * is dispatched, so a request that never dispatches never evaluates it. A connection nobody
 * registered (the Cron Trigger's) reads as off.
 */
const resolvers = new WeakMap<object, () => Promise<boolean>>();

export function registerFencing(db: AnyDb | object, resolve: () => Promise<boolean>): void {
  resolvers.set(db, resolve);
}

export async function fencedFor(db: AnyDb): Promise<boolean> {
  try {
    return (await resolvers.get(db)?.()) ?? false;
  } catch {
    // The flag could not be read: the unfenced path is today's behaviour.
    return false;
  }
}
