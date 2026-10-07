import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { crowdfundingAdminFilters } from '$lib/crowdfunding/admin-filters';
import { OPEN_REPORT_STATUSES, type ReportReason } from '$lib/moderation/reports';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { publicName } from '../db/public-name';
import { crowdfundings, profiles, reports } from '../db/schema';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';

// The admin side of the crowdfunding list: what is up and what was taken down, and taking one down.
// Every function authorizes the actor itself; the routes check again before calling.

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/**
 * One page of the campaigns, newest first. `page` past the last one is `null`, so the route answers
 * 404 (the first page always exists, even empty). Each row counts the reports still waiting on it.
 */
export async function listAdminCrowdfundings(
  db: AnyDb,
  actor: Actor | null,
  params: URLSearchParams,
) {
  authorize(actor, 'moderation:manage');
  const filters = crowdfundingAdminFilters(params);
  const needle = filters.query ? `%${escapeLike(filters.query)}%` : null;
  const where = and(
    filters.status === 'up'
      ? isNull(crowdfundings.removedAt)
      : filters.status === 'removed'
        ? isNotNull(crowdfundings.removedAt)
        : undefined,
    needle ? or(ilike(crowdfundings.name, needle), ilike(crowdfundings.owner, needle)) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(crowdfundings).where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const waiting = db
    .select({
      targetId: reports.targetId,
      waiting: sql<number>`count(*)`.mapWith(Number).as('waiting'),
    })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, 'crowdfunding'),
        inArray(reports.status, [...OPEN_REPORT_STATUSES]),
      ),
    )
    .groupBy(reports.targetId)
    .as('waiting_reports');

  const rows = await db
    .select({
      id: crowdfundings.id,
      name: crowdfundings.name,
      owner: crowdfundings.owner,
      url: crowdfundings.url,
      platform: crowdfundings.platform,
      startsOn: crowdfundings.startsOn,
      endsOn: crowdfundings.endsOn,
      imagePath: crowdfundings.imagePath,
      createdAt: crowdfundings.createdAt,
      removedAt: crowdfundings.removedAt,
      removalReason: crowdfundings.removalReason,
      submitter: publicName(profiles.username),
      reports: sql<number>`coalesce(${waiting.waiting}, 0)`.mapWith(Number),
    })
    .from(crowdfundings)
    .innerJoin(profiles, eq(profiles.id, crowdfundings.submitterId))
    .leftJoin(waiting, eq(waiting.targetId, crowdfundings.id))
    .where(where)
    .orderBy(desc(crowdfundings.createdAt), desc(crowdfundings.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return { rows, total, pages, ...filters };
}

export type AdminCrowdfundings = NonNullable<Awaited<ReturnType<typeof listAdminCrowdfundings>>>;

/**
 * An admin takes a campaign down. It leaves the public list at once, the submitter is told why
 * (`CrowdfundingRemoved`, with the reason and the note) and every report still waiting on it is
 * accepted (each reporter hears it was looked at, never what was done). Refused for one that is
 * already down (`closed`) or unknown (`not_found`). Returns the events to dispatch.
 */
export async function removeCrowdfunding(
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
    const [campaign] = await t
      .select()
      .from(crowdfundings)
      .where(eq(crowdfundings.id, id))
      .for('update');
    if (!campaign) throw new Invalid('id', 'not_found');
    if (campaign.removedAt) throw new Invalid('id', 'closed');

    await t
      .update(crowdfundings)
      .set({
        removedAt: now,
        removedBy: actor!.id,
        removalReason: reason,
        removalNote: note || null,
      })
      .where(eq(crowdfundings.id, id));

    const waiting = await t
      .select({ id: reports.id, reporterId: reports.reporterId })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, 'crowdfunding'),
          eq(reports.targetId, id),
          inArray(reports.status, [...OPEN_REPORT_STATUSES]),
        ),
      )
      .for('update');
    const eventIds: string[] = [];
    for (const report of waiting) {
      await t
        .update(reports)
        .set({ status: 'resolved', resolvedBy: actor!.id, resolvedAt: now })
        .where(eq(reports.id, report.id));
      eventIds.push(
        await recordEvent(
          t,
          {
            type: 'ReportResolved',
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
          type: 'CrowdfundingRemoved',
          actorId: actor!.id,
          payload: {
            crowdfundingId: id,
            name: campaign.name,
            submitterId: campaign.submitterId,
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
