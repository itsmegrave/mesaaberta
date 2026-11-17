import { and, eq, gt, sql } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { events } from '@mesaaberta/core/server/db/schema';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';

/** One entry per admin and section in this window: a visit, not every page view of it. */
export const ADMIN_ENTRY_WINDOW_MINUTES = 30;

/**
 * The section of the admin area a route belongs to: `/admin` for the overview, `/admin/<first
 * segment>` below it. Taken from the route id so a user or table id never ends up in the log.
 */
export function adminSectionOf(routeId: string): string {
  const [, , section] = routeId.split('/');
  return section && !section.startsWith('[') && !section.startsWith('(')
    ? `/admin/${section}`
    : '/admin';
}

/**
 * Records that an admin entered a section of the admin area (`AdminAreaEntered`, for the audit
 * log), unless they already did in the last `ADMIN_ENTRY_WINDOW_MINUTES`. Returns the event id, or
 * null when it was throttled.
 */
export async function recordAdminEntry(
  db: AnyDb,
  { actorId, section, now = new Date() }: { actorId: string; section: string; now?: Date },
): Promise<string | null> {
  const since = new Date(now.getTime() - ADMIN_ENTRY_WINDOW_MINUTES * 60_000);
  const [recent] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.actorId, actorId),
        gt(events.createdAt, since),
        eq(events.type, 'AdminAreaEntered'),
        sql`${events.payload}->>'section' = ${section}`,
      ),
    )
    .limit(1);
  if (recent) return null;
  return recordEvent(db, { type: 'AdminAreaEntered', actorId, payload: { section } }, { now });
}
