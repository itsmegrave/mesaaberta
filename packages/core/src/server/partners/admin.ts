import {
  and,
  arrayContains,
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
import { partnerAdminFilters } from '../../partners/admin-filters';
import { orderedTypes, type PartnerType } from '../../partners/types';
import { OPEN_REPORT_STATUSES, type ReportReason } from '../../moderation/reports';
import type { Network } from '../../profile/social-links';
import { authorize, type Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';
import { NAMELESS, publicName } from '@mesaaberta/core/server/db/public-name';
import {
  partnerInvitations,
  partnerLinks,
  partnerOwners,
  partners,
  profiles,
  reports,
} from '@mesaaberta/core/server/db/schema';
import { Invalid } from '@mesaaberta/core/server/errors';
import { recordEvent } from '@mesaaberta/core/server/events/outbox';

// The admin side of the partners: what waits for review, what is up and what was taken down, and
// approving, rejecting and removing. Every function authorizes the actor itself; the routes check
// again before calling. Who looks after a partner is shown here, and to those accounts only.

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
    filters.type === 'none'
      ? sql`cardinality(${partners.types}) = 0`
      : filters.type
        ? arrayContains(partners.types, [filters.type])
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
      types: partners.types,
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
      submitter: sql<string | null>`${publicName(profiles.username)}`,
      // Who looks after it, in the order they joined (the submitter first). Empty for a partner
      // with no row yet: then it is the submitter alone.
      owners: sql<
        string[]
      >`array(select coalesce(owner.username, ${NAMELESS}) from ${partnerOwners} join ${profiles} owner on owner.id = ${partnerOwners.profileId} where ${partnerOwners.partnerId} = ${partners.id} order by ${partnerOwners.createdAt})`,
      pendingInvites:
        sql<number>`(select count(*) from ${partnerInvitations} where ${partnerInvitations.partnerId} = ${partners.id} and ${partnerInvitations.status} = 'pending' and ${partnerInvitations.expiresAt} > now())`.mapWith(
          Number,
        ),
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
    rows: rows.map((row) => ({
      ...row,
      types: orderedTypes(row.types),
      owners: row.owners.length ? row.owners : row.submitter ? [row.submitter] : [],
      // "Removido por quem cuida": an owner took it off, so there is no reason (an admin gives one).
      withdrawn: row.removedAt !== null && row.removalReason === null,
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

/**
 * An admin corrects a partner's kinds ("Editar tipos…"). Unlike the submitter's edit it does not send
 * the partner back to review: the kinds are a label the admin vouches for, not a link. Refused for
 * one that is taken down (`closed`) or unknown (`not_found`). Returns the `PartnerUpdated` event,
 * which keeps the change in the audit log.
 */
export async function setPartnerTypes(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  types: PartnerType[],
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [partner] = await t.select().from(partners).where(eq(partners.id, id)).for('update');
    if (!partner) throw new Invalid('id', 'not_found');
    if (partner.removedAt) throw new Invalid('id', 'closed');

    const next = orderedTypes(types);
    await t.update(partners).set({ types: next, updatedAt: now }).where(eq(partners.id, id));
    return [
      await recordEvent(
        t,
        {
          type: 'PartnerUpdated',
          actorId: actor!.id,
          payload: {
            partnerId: id,
            name: partner.name,
            changes: { types: { from: partner.types.join(','), to: next.join(',') } },
          },
        },
        { now },
      ),
    ];
  });
}
