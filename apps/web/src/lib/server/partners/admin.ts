import {
  and,
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
import { partnerAdminFilters } from '$lib/partners/admin-filters';
import { OPEN_REPORT_STATUSES, type ReportReason } from '$lib/moderation/reports';
import type { Network } from '$lib/profile/social-links';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { publicName } from '../db/public-name';
import { partnerLinks, partners, profiles, reports } from '../db/schema';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';

// The admin side of the partners: what waits for review, what is up and what was taken down, and
// approving, rejecting and removing. Every function authorizes the actor itself; the routes check
// again before calling. The submitter is shown here and nowhere else.

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

const openReportOn = () =>
  and(
    eq(reports.targetType, 'partner'),
    eq(reports.targetId, partners.id),
    inArray(reports.status, [...OPEN_REPORT_STATUSES]),
  );

/** How many partners wait for an admin, for the count beside "Parceiros" in the admin menu. */
export async function pendingPartnerCount(db: AnyDb): Promise<number> {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(partners)
    .where(and(isNull(partners.approvedAt), isNull(partners.removedAt)));
  return pending;
}

/**
 * One page of the partners, newest first, opening on those that wait for review. `page` past the
 * last one is `null`, so the route answers 404 (the first page always exists, even empty). Each
 * row counts the reports still waiting on it.
 */
export async function listAdminPartners(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = partnerAdminFilters(params);
  const needle = filters.query ? `%${escapeLike(filters.query)}%` : null;
  const where = and(
    filters.status === 'pending'
      ? and(isNull(partners.approvedAt), isNull(partners.removedAt))
      : filters.status === 'up'
        ? and(isNotNull(partners.approvedAt), isNull(partners.removedAt))
        : filters.status === 'reported'
          ? and(
              isNull(partners.removedAt),
              exists(
                db
                  .select({ one: sql`1` })
                  .from(reports)
                  .where(openReportOn()),
              ),
            )
          : filters.status === 'removed'
            ? isNotNull(partners.removedAt)
            : undefined,
    filters.backlink === 'given'
      ? isNotNull(partners.backlinkUrl)
      : filters.backlink === 'missing'
        ? isNull(partners.backlinkUrl)
        : undefined,
    needle
      ? or(
          ilike(partners.name, needle),
          ilike(partners.description, needle),
          ilike(partners.couponCode, needle),
        )
      : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(partners).where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const waiting = db
    .select({
      targetId: reports.targetId,
      waiting: sql<number>`count(*)`.mapWith(Number).as('waiting'),
    })
    .from(reports)
    .where(
      and(eq(reports.targetType, 'partner'), inArray(reports.status, [...OPEN_REPORT_STATUSES])),
    )
    .groupBy(reports.targetId)
    .as('waiting_reports');

  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      description: partners.description,
      logoPath: partners.logoPath,
      siteUrl: partners.siteUrl,
      contactEmail: partners.contactEmail,
      backlinkUrl: partners.backlinkUrl,
      couponCode: partners.couponCode,
      couponDescription: partners.couponDescription,
      createdAt: partners.createdAt,
      approvedAt: partners.approvedAt,
      removedAt: partners.removedAt,
      removedBy: partners.removedBy,
      removalReason: partners.removalReason,
      submitterId: partners.submitterId,
      submitter: sql<string | null>`${publicName(profiles.username)}`,
      reports: sql<number>`coalesce(${waiting.waiting}, 0)`.mapWith(Number),
    })
    .from(partners)
    .leftJoin(profiles, eq(profiles.id, partners.submitterId))
    .leftJoin(waiting, eq(waiting.targetId, partners.id))
    .where(where)
    .orderBy(desc(partners.createdAt), desc(partners.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const links = rows.length
    ? await db
        .select({
          partnerId: partnerLinks.partnerId,
          network: partnerLinks.network,
          url: partnerLinks.url,
        })
        .from(partnerLinks)
        .where(
          inArray(
            partnerLinks.partnerId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(partnerLinks.position)
    : [];

  return {
    rows: rows.map(({ submitterId, ...row }) => ({
      ...row,
      // "Removido pelo autor": the submitter took it off themself.
      withdrawn: row.removedAt !== null && row.removedBy === submitterId,
      links: links
        .filter((link) => link.partnerId === row.id)
        .map(({ network, url }) => ({ network: network as Exclude<Network, 'website'>, url })),
    })),
    total,
    pages,
    ...filters,
  };
}

export type AdminPartners = NonNullable<Awaited<ReturnType<typeof listAdminPartners>>>;

/**
 * Accepts every report still waiting on a partner (each reporter hears it was looked at, never what
 * was done) and returns the events to dispatch. Runs inside the caller's transaction.
 */
export async function resolveOpenPartnerReports(
  t: AnyDb,
  actorId: string,
  partnerId: string,
  now: Date,
): Promise<string[]> {
  const waiting = await t
    .select({ id: reports.id, reporterId: reports.reporterId })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, 'partner'),
        eq(reports.targetId, partnerId),
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
 * An admin approves a partner that waits for review: it goes on the page and its submitter is told
 * (`PartnerApproved`). Refused for one that is already approved (`already_approved`), taken down
 * (`closed`) or unknown (`not_found`). Returns the events to dispatch.
 */
export async function approvePartner(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [partner] = await t.select().from(partners).where(eq(partners.id, id)).for('update');
    if (!partner) throw new Invalid('id', 'not_found');
    if (partner.removedAt) throw new Invalid('id', 'closed');
    if (partner.approvedAt) throw new Invalid('id', 'already_approved');

    await t
      .update(partners)
      .set({ approvedAt: now, approvedBy: actor!.id })
      .where(eq(partners.id, id));
    return [
      await recordEvent(
        t,
        {
          type: 'PartnerApproved',
          actorId: actor!.id,
          payload: { partnerId: id, name: partner.name, submitterId: partner.submitterId },
        },
        { now },
      ),
    ];
  });
}

/**
 * An admin rejects a partner that waits, or takes one off the page. It leaves the list at once, the
 * submitter is told why (`PartnerRemoved`, with the reason and the note) and every report still
 * waiting on it is accepted (each reporter hears it was looked at, never what was done). Refused for
 * one that is already down (`closed`) or unknown (`not_found`). Returns the events to dispatch.
 */
export async function removePartner(
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
    const [partner] = await t.select().from(partners).where(eq(partners.id, id)).for('update');
    if (!partner) throw new Invalid('id', 'not_found');
    if (partner.removedAt) throw new Invalid('id', 'closed');

    await t
      .update(partners)
      .set({
        removedAt: now,
        removedBy: actor!.id,
        removalReason: reason,
        removalNote: note || null,
      })
      .where(eq(partners.id, id));

    const eventIds = await resolveOpenPartnerReports(t, actor!.id, id, now);
    eventIds.push(
      await recordEvent(
        t,
        {
          type: 'PartnerRemoved',
          actorId: actor!.id,
          payload: {
            partnerId: id,
            name: partner.name,
            submitterId: partner.submitterId,
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
