import { and, eq, inArray } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { gameTables, registrations } from '@mesaaberta/core/server/db/schema';
import type { CalendarTable } from '@mesaaberta/core/server/calendar/ics';
import { can, type Actor } from '@mesaaberta/core/server/auth/policy';
import { withSessions } from '@mesaaberta/core/server/calendar/sessions';

/**
 * One table for "Adicionar à agenda" on its page: the same fields as the invite and the person's
 * calendar, so the event has the same UID and sequence and a calendar app updates it instead of
 * adding a second one. Only while the table is going (active, or waiting for its GM to say whether
 * the last session happened), and only to its GM, a player with a confirmed seat or an admin, while
 * their account is active; for anyone else, or another table, null (the api's 404).
 */
export async function readTableCalendar(
  db: AnyDb,
  actor: Actor,
  slug: string,
): Promise<CalendarTable | null> {
  if (actor.status !== 'active') return null;
  const [row] = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      description: gameTables.description,
      extraInfo: gameTables.extraInfo,
      kind: gameTables.kind,
      startsAt: gameTables.startsAt,
      durationMinutes: gameTables.durationMinutes,
      timezone: gameTables.timezone,
      recurrence: gameTables.recurrence,
      until: gameTables.until,
      icalSequence: gameTables.icalSequence,
      gmId: gameTables.gmId,
    })
    .from(gameTables)
    .where(
      and(
        eq(gameTables.slug, slug),
        inArray(gameTables.status, ['active', 'awaiting_confirmation']),
      ),
    );
  if (!row) return null;

  const { gmId, ...found } = row;
  const allowed =
    gmId === actor.id || can(actor, 'admin:access') || (await seated(db, row.id, actor.id));
  if (!allowed) return null;
  const [table] = await withSessions(db, [found]);
  return table;
}

async function seated(db: AnyDb, tableId: string, playerId: string): Promise<boolean> {
  const [seat] = await db
    .select({ playerId: registrations.playerId })
    .from(registrations)
    .where(
      and(
        eq(registrations.tableId, tableId),
        eq(registrations.playerId, playerId),
        eq(registrations.status, 'confirmed'),
      ),
    );
  return Boolean(seat);
}
