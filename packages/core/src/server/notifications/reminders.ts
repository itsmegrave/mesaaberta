// Relative imports only: the reminders go out from the Cron Trigger's Worker, which is bundled
// without SvelteKit's `#lib` alias.
import { and, eq, gt, inArray, lte } from 'drizzle-orm';
import { routes } from '../../routes';
import type { AnyDb } from '../db/client';
import { gameTables, notifications, registrations } from '../db/schema';
import { NOTIFICATION_KINDS, type TableMetadata } from '../../notifications/kinds';

const HOUR = 3600 * 1000;

/** How long before a session each reminder goes out: a day before, then an hour before. */
export type ReminderWindow = '24h' | '1h';

/**
 * Which reminder a session that starts at `startsAt` is due for at `now`: the hour one in its last
 * hour, the day one in the 23 hours before that, none otherwise. A table published (or moved) less
 * than a day ahead gets only what is still ahead of it.
 */
export function reminderWindow(startsAt: Date, now: Date): ReminderWindow | null {
  const ahead = startsAt.getTime() - now.getTime();
  if (ahead <= 0 || ahead > 24 * HOUR) return null;
  return ahead <= HOUR ? '1h' : '24h';
}

/**
 * The id that stands in for an event on a reminder: the same for one table, start and window, so a
 * second run (every five minutes) adds nothing, while a session moved to another time gets its own
 * reminders. A UUID from the SHA-256 of the three (version 8, RFC 9562).
 */
export async function reminderId(
  tableId: string,
  startsAt: Date,
  window: ReminderWindow,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`session_reminder:${tableId}:${startsAt.toISOString()}:${window}`),
    ),
  );
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Reminds the GM and the confirmed players of every open table whose session starts within a day:
 * once a day before and once an hour before, in the bell. The notice carries the start as an ISO
 * time, so each person reads it in their own timezone. Someone confirmed after a reminder went out
 * gets it on the next run. Returns how many it wrote.
 */
export async function sendSessionReminders(db: AnyDb, now = new Date()): Promise<number> {
  const due = await db
    .select({
      id: gameTables.id,
      slug: gameTables.slug,
      title: gameTables.title,
      startsAt: gameTables.startsAt,
      gmId: gameTables.gmId,
    })
    .from(gameTables)
    .where(
      and(
        eq(gameTables.status, 'active'),
        gt(gameTables.startsAt, now),
        lte(gameTables.startsAt, new Date(now.getTime() + 24 * HOUR)),
      ),
    );
  if (due.length === 0) return 0;

  const seats = await db
    .select({ tableId: registrations.tableId, playerId: registrations.playerId })
    .from(registrations)
    .where(
      and(
        inArray(
          registrations.tableId,
          due.map((table) => table.id),
        ),
        eq(registrations.status, 'confirmed'),
      ),
    );

  const rows: (typeof notifications.$inferInsert)[] = [];
  for (const table of due) {
    const window = reminderWindow(table.startsAt, now);
    if (!window) continue;
    const eventId = await reminderId(table.id, table.startsAt, window);
    const metadata: TableMetadata = {
      tableId: table.id,
      slug: table.slug,
      title: table.title,
      startsAt: table.startsAt.toISOString(),
      window,
    };
    const players = seats.filter((seat) => seat.tableId === table.id).map((seat) => seat.playerId);
    for (const recipientId of new Set([table.gmId, ...players])) {
      rows.push({
        recipientId,
        eventId,
        category: NOTIFICATION_KINDS.session_reminder.category,
        type: 'session_reminder',
        link: routes.table(table.slug),
        metadata,
        createdAt: now,
      });
    }
  }
  if (rows.length === 0) return 0;

  const written = await db
    .insert(notifications)
    .values(rows)
    .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] })
    .returning({ id: notifications.id });
  return written.length;
}
