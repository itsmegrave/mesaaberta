import { and, eq, gt, inArray, or } from 'drizzle-orm';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { gameTables, profiles, registrations } from '@mesaaberta/core/server/db/schema';
import type { CalendarTable } from '@mesaaberta/core/server/calendar/ics';
import { bytesToBase64 } from '../base64';
import { recordEvent } from '../events/outbox';

/** How far back the subscribed feed keeps a table, so a session already played stays in it. */
export const FEED_PAST_DAYS = 60;

/** The secret in a feed address: 32 random bytes, base64url (43 characters). */
export const FEED_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * The tables in a person's calendar: the active ones they run, and the active ones where they have
 * a confirmed seat (a pending request is not in the calendar yet). A table whose session has
 * begun is left out. With `since` (the subscribed feed), a table whose session began after it stays,
 * held or not, so a calendar app does not drop what was already played.
 */
export async function listCalendarTables(
  db: AnyDb,
  profileId: string,
  now: Date,
  since?: Date,
): Promise<CalendarTable[]> {
  const seated = db
    .select({ id: registrations.tableId })
    .from(registrations)
    .where(and(eq(registrations.playerId, profileId), eq(registrations.status, 'confirmed')));

  return db
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
    })
    .from(gameTables)
    .where(
      and(
        since
          ? inArray(gameTables.status, ['active', 'awaiting_confirmation', 'concluded'])
          : eq(gameTables.status, 'active'),
        gt(gameTables.startsAt, since ?? now),
        or(eq(gameTables.gmId, profileId), inArray(gameTables.id, seated)),
      ),
    );
}

const newToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** The person's feed secret, or null when they have no feed. */
export async function calendarFeedTokenOf(db: AnyDb, profileId: string): Promise<string | null> {
  const [row] = await db
    .select({ token: profiles.calendarFeedToken })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  return row?.token ?? null;
}

/**
 * Turns the person's feed on with a new secret (the old address, if any, stops working) or off.
 * Answers the secret now in place.
 */
export async function setCalendarFeed(db: AnyDb, profileId: string, on: boolean) {
  const token = on ? newToken() : null;
  await db.update(profiles).set({ calendarFeedToken: token }).where(eq(profiles.id, profileId));
  const eventId = await recordEvent(db, {
    type: 'CalendarFeedChanged',
    actorId: profileId,
    payload: { profileId, on },
  });
  return { token, eventIds: [eventId] };
}

/** Whose feed a secret opens: an active person's id, or null for an unknown secret. */
export async function calendarFeedOwner(db: AnyDb, token: string): Promise<string | null> {
  if (!FEED_TOKEN.test(token)) return null;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.calendarFeedToken, token), eq(profiles.status, 'active')));
  return row?.id ?? null;
}
