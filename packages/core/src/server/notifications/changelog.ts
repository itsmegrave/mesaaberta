// Relative imports only, and nothing from SvelteKit: the delivery graph reaches this file.
import { and, eq, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { events } from '../db/schema';
import { recordEvent } from '../events/outbox';
import { countAudience } from './audience';

/** A changelog day older than this is history, not news: it never reaches the bell. */
const FRESH_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

export type ChangelogDay = { date: string; title: string; summary: string; link: string };

/**
 * Tells everyone, in the bell, about the newest changelog day, once. The day is the key: the
 * announcement is recorded with its date, and a day that already has one is never sent again, so
 * running this on every deploy (or from several isolates at once) sends it a single time. A day
 * older than three days is skipped, so the first run does not replay the whole history. Returns
 * the id of the announcement, or null when there was nothing to send.
 */
export async function announceChangelogDay(
  db: AnyDb,
  day: ChangelogDay,
  now: Date = new Date(),
): Promise<string | null> {
  const published = Date.parse(`${day.date}T00:00:00Z`);
  if (Number.isNaN(published) || now.getTime() - published > FRESH_DAYS * DAY) return null;

  return db.transaction(async (tx) => {
    // One at a time across isolates: the check and the write below must not interleave. Never
    // wait for the lock: every new isolate asks at once after a deploy, and waiting ones queued
    // behind a slow holder until the statement timeout (2 min) cancelled them. The holder is
    // sending this very day, so one that finds it taken has nothing to do.
    const result: unknown = await tx.execute(
      sql`select pg_try_advisory_xact_lock(hashtext('changelog-announcement')) as locked`,
    );
    // postgres.js answers with the rows, PGlite with `{ rows }`.
    type Row = { locked: boolean };
    const rows = (Array.isArray(result) ? result : (result as { rows: Row[] }).rows) as Row[];
    if (rows[0]?.locked !== true) return null;
    const [sent] = await tx
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.type, 'SystemAnnouncementSent'),
          sql`${events.payload} ->> 'changelogDate' = ${day.date}`,
        ),
      )
      .limit(1);
    if (sent) return null;

    return recordEvent(tx, {
      type: 'SystemAnnouncementSent',
      actorId: null,
      payload: {
        title: day.title,
        body: day.summary,
        icon: 'megaphone',
        tone: 'announcement',
        link: day.link,
        audience: 'all_active_users',
        recipientId: null,
        estimated: await countAudience(tx, 'all_active_users'),
        changelogDate: day.date,
      },
    });
  });
}
