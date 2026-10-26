import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { OPEN_REPORT_STATUSES, type ReportReason } from '../../moderation/reports';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { places, reports } from '@mesaaberta/core/server/db/schema';
import { Invalid } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { clearPlaceTags, rebuildPlaceTags } from './tags';

// The admin side of "Onde jogar": approving, rejecting and removing places. Every function
// authorizes the actor itself; the routes check again before calling.

/** How many places wait for an admin, for the count beside "Lugares" in the admin menu. */
export async function pendingPlaceCount(db: AnyDb): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(places)
    .where(and(isNull(places.approvedAt), isNull(places.removedAt)));
  return pending;
}

/**
 * Accepts every report still waiting on a place (each reporter hears it was looked at, never what
 * was done) and returns the events to dispatch. Runs inside the caller's transaction.
 */
export async function resolveOpenPlaceReports(
  t: AnyDb,
  actorId: string,
  placeId: string,
  now: Date,
): Promise<string[]> {
  const waiting = await t
    .select({ id: reports.id, reporterId: reports.reporterId })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, 'place'),
        eq(reports.targetId, placeId),
        inArray(reports.status, [...OPEN_REPORT_STATUSES]),
      ),
    )
    .for('update');
  const eventIds: string[] = [];
  for (const report of waiting) {
    await t
      .update(reports)
      .set({ status: 'resolved', resolvedBy: actorId, resolvedAt: now })
      .where(eq(reports.id, report.id));
    eventIds.push(
      await recordEvent(
        t,
        {
          type: 'ReportResolved',
          actorId,
          payload: { reportId: report.id, reporterId: report.reporterId },
        },
        { now },
      ),
    );
  }
  return eventIds;
}

/**
 * An admin approves a place that waits for review: it goes on /places with tags made from its
 * address, kind and amenities, and its submitter is told (`PlaceApproved`). Refused for one that is
 * already approved (`already_approved`), taken down (`closed`) or unknown (`not_found`). Returns
 * the events to dispatch.
 */
export async function approvePlace(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t.select().from(places).where(eq(places.id, id)).for('update');
    if (!place) throw new Invalid('id', 'not_found');
    if (place.removedAt) throw new Invalid('id', 'closed');
    if (place.approvedAt) throw new Invalid('id', 'already_approved');

    await t.update(places).set({ approvedAt: now, approvedBy: actor!.id }).where(eq(places.id, id));
    await rebuildPlaceTags(t, id, place);
    return [
      await recordEvent(
        t,
        {
          type: 'PlaceApproved',
          actorId: actor!.id,
          payload: {
            placeId: id,
            slug: place.slug,
            name: place.name,
            submitterId: place.submitterId,
          },
        },
        { now },
      ),
    ];
  });
}

/**
 * An admin rejects a place that waits, or takes one off the list. It leaves the list, its tags and
 * the table picker at once (tables that picked it keep their copied area), the submitter is told
 * why (`PlaceRemoved`, with the reason) and every report still waiting on it is accepted. Refused
 * for one that is already down (`closed`) or unknown (`not_found`). Returns the events to dispatch.
 */
export async function removePlace(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  {
    reason,
    note,
    reportId = null,
  }: { reason: ReportReason; note: string; reportId?: string | null },
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t.select().from(places).where(eq(places.id, id)).for('update');
    if (!place) throw new Invalid('id', 'not_found');
    if (place.removedAt) throw new Invalid('id', 'closed');

    await t
      .update(places)
      .set({
        removedAt: now,
        removedBy: actor!.id,
        removalReason: reason,
        removalNote: note.trim() || null,
      })
      .where(eq(places.id, id));
    await clearPlaceTags(t, id);

    const eventIds = await resolveOpenPlaceReports(t, actor!.id, id, now);
    eventIds.push(
      await recordEvent(
        t,
        {
          type: 'PlaceRemoved',
          actorId: actor!.id,
          payload: {
            placeId: id,
            slug: place.slug,
            name: place.name,
            submitterId: place.submitterId,
            reason,
            reportId: reportId || null,
          },
        },
        { now },
      ),
    );
    return eventIds;
  });
}
