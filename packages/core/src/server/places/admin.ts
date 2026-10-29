import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from 'drizzle-orm';
import { OPEN_REPORT_STATUSES, type ReportReason } from '../../moderation/reports';
import { placeAdminFilters } from '../../places/admin-filters';
import type { PlaceKind } from '../../places/types';
import { publicName } from '@mesaaberta/core/server/db/public-name';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { places, profiles, reports } from '@mesaaberta/core/server/db/schema';
import { Invalid } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';
import { featuresOf } from './features';
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

/** How many places reports hid and an admin has not decided on yet: the high alert on /admin. */
export async function hiddenPlaceCount(db: AnyDb): Promise<number> {
  const [{ hidden }] = await db
    .select({ hidden: count() })
    .from(places)
    .where(and(isNotNull(places.hiddenAt), isNull(places.removedAt)));
  return hidden;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

const openReportOn = () =>
  and(
    eq(reports.targetType, 'place'),
    eq(reports.targetId, places.id),
    inArray(reports.status, [...OPEN_REPORT_STATUSES]),
  );

/**
 * One page of the places for `/admin/places`, oldest first so the queue is worked in order, opening
 * on those that wait for review. `page` past the last one is `null`, so the route answers 404 (the
 * first page always exists, even empty). Each row counts the reports still waiting on it and names
 * whoever sent it.
 */
export async function listAdminPlaces(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = placeAdminFilters(params);
  const needle = filters.query ? `%${escapeLike(filters.query.replace(/^@/, ''))}%` : null;
  const where = and(
    filters.status === 'pending'
      ? and(isNull(places.approvedAt), isNull(places.removedAt))
      : filters.status === 'up'
        ? and(isNotNull(places.approvedAt), isNull(places.removedAt))
        : filters.status === 'reported'
          ? and(
              isNull(places.removedAt),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(reports)
                  .where(openReportOn()),
              ),
            )
          : filters.status === 'removed'
            ? isNotNull(places.removedAt)
            : undefined,
    needle
      ? or(
          ilike(places.name, needle),
          ilike(places.city, needle),
          ilike(places.neighbourhood, needle),
          ilike(profiles.username, needle),
        )
      : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(places)
    .leftJoin(profiles, eq(profiles.id, places.submitterId))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      kind: places.kind,
      street: places.street,
      complement: places.complement,
      neighbourhood: places.neighbourhood,
      city: places.city,
      state: places.state,
      postalCode: places.postalCode,
      imagePath: places.imagePath,
      createdAt: places.createdAt,
      approvedAt: places.approvedAt,
      hiddenAt: places.hiddenAt,
      removedAt: places.removedAt,
      removalReason: places.removalReason,
      owned: sql<boolean>`${places.ownerId} is not null`,
      submitter: publicName(profiles.username),
      reports:
        sql<number>`(select count(*) from ${reports} where ${reports.targetType} = 'place' and ${reports.targetId} = ${places.id} and ${inArray(reports.status, [...OPEN_REPORT_STATUSES])})`.mapWith(
          Number,
        ),
    })
    .from(places)
    .leftJoin(profiles, eq(profiles.id, places.submitterId))
    .where(where)
    // What reports hid comes first, whatever the filter: it is the high alert.
    .orderBy(
      desc(sql`${places.hiddenAt} is not null and ${places.removedAt} is null`),
      asc(places.createdAt),
      asc(places.id),
    )
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  // The tags it picked, the ones still waiting for an admin marked: approving lists the rest.
  const features = await featuresOf(
    db,
    rows.map((row) => row.id),
    { withPending: true },
  );
  return {
    ...filters,
    total,
    pages,
    rows: rows.map((row) => ({
      ...row,
      kind: row.kind as PlaceKind,
      features: features.get(row.id) ?? [],
    })),
  };
}

export type AdminPlaces = NonNullable<Awaited<ReturnType<typeof listAdminPlaces>>>;

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
 * address, kind and approved catalog tags, and its submitter is told (`PlaceApproved`). Refused for one that is
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

/**
 * An admin puts back a place its reports hid: the reports still waiting on it are dismissed with
 * the note (each reporter hears it was looked at), it is listed again and its keepers are told
 * (`PlaceRestored`). Refused for one that is not hidden (`not_hidden`), is down (`closed`) or is
 * unknown (`not_found`). Returns the events to dispatch.
 */
export async function restorePlace(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { note }: { note: string },
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [place] = await t.select().from(places).where(eq(places.id, id)).for('update');
    if (!place) throw new Invalid('id', 'not_found');
    if (place.removedAt) throw new Invalid('id', 'closed');
    if (!place.hiddenAt) throw new Invalid('id', 'not_hidden');

    await t.update(places).set({ hiddenAt: null, hiddenReason: null }).where(eq(places.id, id));
    const waiting = await t
      .select({ id: reports.id, reporterId: reports.reporterId })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, 'place'),
          eq(reports.targetId, id),
          inArray(reports.status, [...OPEN_REPORT_STATUSES]),
        ),
      )
      .for('update');
    const eventIds: string[] = [];
    for (const report of waiting) {
      await t
        .update(reports)
        .set({
          status: 'dismissed',
          resolvedBy: actor!.id,
          resolutionNote: note.trim() || null,
          resolvedAt: now,
        })
        .where(eq(reports.id, report.id));
      eventIds.push(
        await recordEvent(
          t,
          {
            type: 'ReportDismissed',
            actorId: actor!.id,
            payload: { reportId: report.id, reporterId: report.reporterId },
          },
          { now },
        ),
      );
    }
    eventIds.push(
      await recordEvent(
        t,
        {
          type: 'PlaceRestored',
          actorId: actor!.id,
          payload: {
            placeId: id,
            slug: place.slug,
            name: place.name,
            submitterId: place.submitterId,
            ownerId: place.ownerId,
          },
        },
        { now },
      ),
    );
    return eventIds;
  });
}
