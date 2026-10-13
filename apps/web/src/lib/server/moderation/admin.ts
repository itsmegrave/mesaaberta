import { and, asc, count, desc, eq, ilike, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  auditFilters,
  reportFilters,
  type AuditKind,
  type ReportFilter,
} from '$lib/admin/report-filters';
import { OPEN_REPORT_STATUSES, type ReportStatus } from '$lib/moderation/reports';
import { authorize, can, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import {
  crowdfundings,
  events,
  gameTables,
  partnerLinks,
  partners,
  profiles,
  registrations,
  reports,
} from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { removeTableMember } from '../messages/service';
export { liftExpiredBans } from './bans';
import type { EventType } from '../events/types';

// The admin side of moderation: the report queue and its decisions, suspending accounts, and the
// audit log. Every function authorizes the actor itself; the routes check again before calling.

const reporter = alias(profiles, 'reporter');
const reported = alias(profiles, 'reported');
const gm = alias(profiles, 'gm');

const statusesOf = (filter: ReportFilter): readonly ReportStatus[] | null =>
  filter === 'all' ? null : filter === 'waiting' ? OPEN_REPORT_STATUSES : [filter];

/**
 * One page of the queue, newest first unless the admin turns it around. `page` past the last one is
 * `null`, so the route answers 404 (the first page always exists, even empty). The filter's counts
 * are what each status would show with the same kind of report.
 */
export async function listReports(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = reportFilters(params);
  const statuses = statusesOf(filters.status);
  const aboutTarget = filters.target === 'all' ? undefined : eq(reports.targetType, filters.target);
  const where = and(statuses ? inArray(reports.status, [...statuses]) : undefined, aboutTarget);

  const [counted] = await db
    .select({
      all: count(),
      waiting:
        sql<number>`count(*) filter (where ${inArray(reports.status, [...OPEN_REPORT_STATUSES])})`.mapWith(
          Number,
        ),
      resolved: sql<number>`count(*) filter (where ${eq(reports.status, 'resolved')})`.mapWith(
        Number,
      ),
      dismissed: sql<number>`count(*) filter (where ${eq(reports.status, 'dismissed')})`.mapWith(
        Number,
      ),
    })
    .from(reports)
    .where(aboutTarget);
  const total = counted[filters.status];
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;
  const direction = filters.sort.dir === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      table: gameTables.title,
      gm: gm.username,
      player: reported.username,
      // The campaign a crowdfunding report is about: it has no table.
      crowdfunding: crowdfundings.name,
      // The partner a partner report is about: it has no table either.
      partner: partners.name,
      reporter: reporter.username,
    })
    .from(reports)
    // Left joins: a report about a campaign has no table, and must still be in the queue.
    .leftJoin(gameTables, eq(gameTables.id, reports.tableId))
    .leftJoin(gm, eq(gm.id, gameTables.gmId))
    .innerJoin(reporter, eq(reporter.id, reports.reporterId))
    .leftJoin(reported, and(eq(reports.targetType, 'player'), eq(reported.id, reports.targetId)))
    .leftJoin(
      crowdfundings,
      and(eq(reports.targetType, 'crowdfunding'), eq(crowdfundings.id, reports.targetId)),
    )
    .leftJoin(partners, and(eq(reports.targetType, 'partner'), eq(partners.id, reports.targetId)))
    .where(where)
    .orderBy(direction(reports.createdAt), direction(reports.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  return { rows, total, pages, counts: counted, ...filters };
}

export type AdminReports = NonNullable<Awaited<ReturnType<typeof listReports>>>;

/** How many reports wait on an admin, for the overview and the nav. */
export async function waitingReports(db: AnyDb) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(reports)
    .where(inArray(reports.status, [...OPEN_REPORT_STATUSES]));
  return total;
}

/**
 * A report with what an admin needs to decide: the table it is about (and its GM), the reported
 * player and whether they still have a seat, the reporter, and what the admin may do from here.
 */
export async function reportDetail(db: AnyDb, actor: Actor | null, id: string) {
  authorize(actor, 'moderation:manage');
  const [row] = await db
    .select({
      report: reports,
      reporter: { id: reporter.id, username: reporter.username },
      table: {
        id: gameTables.id,
        slug: gameTables.slug,
        title: gameTables.title,
        status: gameTables.status,
        startsAt: gameTables.startsAt,
        timezone: gameTables.timezone,
      },
      gm: { id: gm.id, username: gm.username, status: gm.status },
    })
    .from(reports)
    .innerJoin(reporter, eq(reporter.id, reports.reporterId))
    // Left joins: a report about a campaign has no table (nor a GM) and must still open.
    .leftJoin(gameTables, eq(gameTables.id, reports.tableId))
    .leftJoin(gm, eq(gm.id, gameTables.gmId))
    .where(eq(reports.id, id));
  if (!row) return null;

  // The campaign a crowdfunding report is about, with who added it and whether it is still up.
  const [campaign] =
    row.report.targetType === 'crowdfunding'
      ? await db
          .select({
            id: crowdfundings.id,
            name: crowdfundings.name,
            owner: crowdfundings.owner,
            url: crowdfundings.url,
            platform: crowdfundings.platform,
            startsOn: crowdfundings.startsOn,
            endsOn: crowdfundings.endsOn,
            removedAt: crowdfundings.removedAt,
            submitter: { id: profiles.id, username: profiles.username },
            importSource: crowdfundings.importSource,
          })
          .from(crowdfundings)
          .leftJoin(profiles, eq(profiles.id, crowdfundings.submitterId))
          .where(eq(crowdfundings.id, row.report.targetId))
      : [];

  // The partner a partner report is about: its links, who sent it (admins only) and whether it is up.
  const [partner] =
    row.report.targetType === 'partner'
      ? await db
          .select({
            id: partners.id,
            name: partners.name,
            description: partners.description,
            siteUrl: partners.siteUrl,
            contactEmail: partners.contactEmail,
            backlinkUrl: partners.backlinkUrl,
            couponCode: partners.couponCode,
            approvedAt: partners.approvedAt,
            removedAt: partners.removedAt,
            submitter: { id: profiles.id, username: profiles.username },
          })
          .from(partners)
          .leftJoin(profiles, eq(profiles.id, partners.submitterId))
          .where(eq(partners.id, row.report.targetId))
      : [];
  const partnerLinkRows = partner
    ? await db
        .select({ network: partnerLinks.network, url: partnerLinks.url })
        .from(partnerLinks)
        .where(eq(partnerLinks.partnerId, partner.id))
        .orderBy(partnerLinks.position)
    : [];

  const [player] =
    row.report.targetType === 'player' && row.table
      ? await db
          .select({
            id: reported.id,
            username: reported.username,
            status: reported.status,
            seat: registrations.status,
          })
          .from(reported)
          .leftJoin(
            registrations,
            and(eq(registrations.playerId, reported.id), eq(registrations.tableId, row.table.id)),
          )
          .where(eq(reported.id, row.report.targetId))
      : [];

  // Who a ban from this report would hit: the reported player. A table report bans no one from
  // here: its GM is banned from their own page, where the reports against their tables add up. The
  // whole row goes to the policy, which alone reads the role.
  const [subjectProfile] = player
    ? await db.select().from(profiles).where(eq(profiles.id, player.id))
    : [];
  const open = (OPEN_REPORT_STATUSES as readonly string[]).includes(row.report.status);
  return {
    ...row,
    player: player ?? null,
    crowdfunding: campaign ?? null,
    partner: partner ? { ...partner, links: partnerLinkRows } : null,
    can: {
      review: row.report.status === 'open',
      close: open,
      closeTable: open && row.report.targetType === 'table' && row.table?.status === 'active',
      removeCrowdfunding: open && !!campaign && !campaign.removedAt,
      removePartner: open && !!partner && !partner.removedAt,
      ban:
        open &&
        !!subjectProfile &&
        subjectProfile.status === 'active' &&
        can(actor, 'account:ban', subjectProfile),
    },
  };
}

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof reportDetail>>>;

async function reportForDecision(db: AnyDb, id: string) {
  const [report] = await db
    .select({
      id: reports.id,
      status: reports.status,
      reporterId: reports.reporterId,
      targetType: reports.targetType,
      targetId: reports.targetId,
      tableId: reports.tableId,
    })
    .from(reports)
    .where(eq(reports.id, id));
  if (!report) throw new Invalid('id', 'not_found');
  return report;
}

const isOpen = (status: ReportStatus) =>
  (OPEN_REPORT_STATUSES as readonly string[]).includes(status);

/** An admin takes a report up: it stays waiting, marked as being looked at. */
export async function startReview(db: AnyDb, actor: Actor | null, id: string) {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const report = await reportForDecision(t, id);
    if (report.status !== 'open') throw new Invalid('id', 'not_open');
    await t.update(reports).set({ status: 'reviewing' }).where(eq(reports.id, id));
    return recordEvent(t, {
      type: 'ReportReviewing',
      actorId: actor!.id,
      payload: { reportId: id, reporterId: report.reporterId },
    });
  });
}

/** Writes the outcome on a report that is still waiting, and its event. Inside a transaction. */
async function settle(
  t: AnyDb,
  actor: Actor,
  report: Awaited<ReturnType<typeof reportForDecision>>,
  outcome: 'resolved' | 'dismissed',
  note: string,
  now: Date,
) {
  if (!isOpen(report.status)) throw new Invalid('id', 'closed');
  await t
    .update(reports)
    .set({ status: outcome, resolvedBy: actor.id, resolutionNote: note || null, resolvedAt: now })
    .where(eq(reports.id, report.id));
  return recordEvent(t, {
    type: outcome === 'resolved' ? 'ReportResolved' : 'ReportDismissed',
    actorId: actor.id,
    payload: { reportId: report.id, reporterId: report.reporterId },
  });
}

/**
 * An admin closes a report without acting on it here: accepted (`resolved`) or dismissed, with an
 * optional note for the other admins.
 */
export async function closeReport(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  outcome: 'resolved' | 'dismissed',
  note: string,
  { now = new Date() }: { now?: Date } = {},
) {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    return settle(t, actor!, await reportForDecision(t, id), outcome, note, now);
  });
}

/**
 * Closes the table a report is about and accepts the report. The table is disabled (its players
 * get the usual cancellation through `TableDisabled`), and the justification stays on it for its GM
 * with the table; `TableClosedByModeration` tells them in the bell.
 */
export async function closeReportedTable(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  note: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const report = await reportForDecision(t, id);
    if (report.targetType !== 'table' || !report.tableId) throw new Invalid('id', 'not_found');
    const [table] = await t
      .select()
      .from(gameTables)
      .where(eq(gameTables.id, report.tableId))
      .for('update');
    if (table.status !== 'active') throw new Invalid('id', 'closed');

    const accepted = await settle(t, actor!, report, 'resolved', note, now);
    await t
      .update(gameTables)
      .set({
        status: 'disabled',
        icalSequence: table.icalSequence + 1,
        moderatedAt: now,
        moderationNote: note,
      })
      .where(eq(gameTables.id, table.id));
    const facts = { tableId: table.id, slug: table.slug, title: table.title };
    return [
      accepted,
      await recordEvent(t, { type: 'TableDisabled', actorId: actor!.id, payload: facts }),
      await recordEvent(t, {
        type: 'TableClosedByModeration',
        actorId: actor!.id,
        payload: { ...facts, reportId: report.id },
      }),
    ];
  });
}

/**
 * Closes an active table from the admin's tables list, with no report behind it: the same effect as
 * closing a reported one (disabled, the players cancelled, the justification kept for its GM and the
 * GM told in the bell). Returns the events to dispatch.
 */
export async function closeTableByAdmin(
  db: AnyDb,
  actor: Actor | null,
  tableId: string,
  note: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  authorize(actor, 'moderation:manage');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [table] = await t
      .select()
      .from(gameTables)
      .where(eq(gameTables.id, tableId))
      .for('update');
    if (!table) throw new Invalid('tableId', 'not_found');
    if (table.status !== 'active') throw new Invalid('tableId', 'closed');
    await t
      .update(gameTables)
      .set({
        status: 'disabled',
        icalSequence: table.icalSequence + 1,
        moderatedAt: now,
        moderationNote: note,
      })
      .where(eq(gameTables.id, table.id));
    const facts = { tableId: table.id, slug: table.slug, title: table.title };
    return [
      await recordEvent(t, { type: 'TableDisabled', actorId: actor!.id, payload: facts }),
      await recordEvent(t, {
        type: 'TableClosedByModeration',
        actorId: actor!.id,
        payload: { ...facts, reportId: null },
      }),
    ];
  });
}

/**
 * Bans an account until `until` (null: for good), with the reason it is told by e-mail. It is signed
 * out and cannot sign in, open a table or join one; the tables it runs that are still open are
 * disabled (`TableDisabled` cancels the invites) and it leaves the tables it plays at
 * (`PlayerLeft`, so their GMs see the seat free up). Returns the events to dispatch. A profile that
 * is already banned is refused: revoke first to change a ban.
 */
export async function banAccount(
  db: AnyDb,
  actor: Actor | null,
  profileId: string,
  {
    until,
    reason,
    reportId = null,
    now = new Date(),
  }: {
    until: Date | null;
    reason: string;
    reportId?: string | null;
    now?: Date;
  },
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [target] = await t
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .for('update');
    if (!target) throw new NotFound('no such profile');
    authorize(actor, 'account:ban', target);
    if (target.status === 'suspended') throw new Invalid('profileId', 'banned');

    await t
      .update(profiles)
      .set({ status: 'suspended', bannedAt: now, bannedUntil: until, banReason: reason })
      .where(eq(profiles.id, profileId));
    const eventIds: string[] = [];

    const open = await t
      .select({
        id: gameTables.id,
        slug: gameTables.slug,
        title: gameTables.title,
        icalSequence: gameTables.icalSequence,
      })
      .from(gameTables)
      .where(and(eq(gameTables.gmId, profileId), eq(gameTables.status, 'active')));
    for (const table of open) {
      await t
        .update(gameTables)
        .set({ status: 'disabled', icalSequence: table.icalSequence + 1 })
        .where(eq(gameTables.id, table.id));
      eventIds.push(
        await recordEvent(t, {
          type: 'TableDisabled',
          actorId: actor!.id,
          payload: { tableId: table.id, slug: table.slug, title: table.title },
        }),
      );
    }

    const seats = await t
      .select({ tableId: registrations.tableId, slug: gameTables.slug })
      .from(registrations)
      .innerJoin(gameTables, eq(gameTables.id, registrations.tableId))
      .where(eq(registrations.playerId, profileId));
    for (const seat of seats) {
      await t
        .delete(registrations)
        .where(and(eq(registrations.tableId, seat.tableId), eq(registrations.playerId, profileId)));
      await removeTableMember(t, seat.tableId, profileId);
      eventIds.push(
        await recordEvent(t, {
          type: 'PlayerLeft',
          actorId: actor!.id,
          payload: { tableId: seat.tableId, slug: seat.slug, playerId: profileId, reason: 'left' },
        }),
      );
    }

    if (reportId) {
      const report = await reportForDecision(t, reportId);
      if (report.targetType !== 'player' || report.targetId !== profileId)
        throw new Invalid('id', 'not_found');
      eventIds.push(await settle(t, actor!, report, 'resolved', reason, now));
    }
    eventIds.push(
      await recordEvent(t, {
        type: 'AccountBanned',
        actorId: actor!.id,
        payload: { profileId, until: until?.toISOString() ?? null, reportId },
      }),
    );
    return eventIds;
  });
}

/** Revokes a ban. The tables and seats it took stay gone: the person starts again. */
export async function revokeBan(
  db: AnyDb,
  actor: Actor | null,
  profileId: string,
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [target] = await t
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .for('update');
    if (!target) throw new NotFound('no such profile');
    authorize(actor, 'account:ban', target);
    // A closed account is suspended with no ban on it: it cannot come back.
    if (target.status === 'active' || !target.bannedAt) return [];

    await t
      .update(profiles)
      .set({ status: 'active', bannedAt: null, bannedUntil: null, banReason: null })
      .where(eq(profiles.id, profileId));
    return [
      await recordEvent(t, {
        type: 'AccountReinstated',
        actorId: actor!.id,
        payload: { profileId },
      }),
    ];
  });
}

/**
 * What the user's admin page needs to moderate them: whether this admin may ban or revoke, the
 * ban if there is one, and how many reports against the tables they run were accepted (the case for
 * a platform ban, which the admin decides).
 */
export async function moderationOf(db: AnyDb, actor: Actor | null, profileId: string) {
  authorize(actor, 'moderation:manage');
  const [target] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!target) return null;
  const [{ accepted }] = await db
    .select({ accepted: count() })
    .from(reports)
    .innerJoin(gameTables, eq(gameTables.id, reports.tableId))
    .where(
      and(
        eq(reports.targetType, 'table'),
        eq(reports.status, 'resolved'),
        eq(gameTables.gmId, profileId),
      ),
    );
  return {
    canModerate: can(actor, 'account:ban', target) && target.username !== null,
    ban: target.bannedAt
      ? { at: target.bannedAt, until: target.bannedUntil, reason: target.banReason ?? '' }
      : null,
    acceptedTableReports: accepted,
  };
}

/** Events that are an admin's decision whoever the table belongs to. */
export const AUDIT_EVENT_TYPES = [
  'ReportReviewing',
  'ReportResolved',
  'ReportDismissed',
  'AccountBanned',
  'AccountReinstated',
  'AccountBanLifted',
  'TableClosedByModeration',
  'CatalogEntryCreated',
  'CatalogEntryApproved',
  'CatalogEntryRejected',
  'CatalogEntryRenamed',
  'CatalogEntryMerged',
  'CatalogEntryDisabled',
  'SystemAnnouncementSent',
  'EventForced',
] as const satisfies readonly EventType[];

/** The events each kind of decision is made of; `all` is every decision the log keeps. */
const AUDIT_KIND_TYPES: Record<Exclude<AuditKind, 'all'>, readonly EventType[]> = {
  reports: ['ReportReviewing', 'ReportResolved', 'ReportDismissed'],
  accounts: ['AccountBanned', 'AccountReinstated', 'AccountBanLifted', 'PlayerLeft'],
  tables: ['TableClosedByModeration', 'TableDisabled'],
  catalog: [
    'CatalogEntryCreated',
    'CatalogEntryApproved',
    'CatalogEntryRejected',
    'CatalogEntryRenamed',
    'CatalogEntryMerged',
    'CatalogEntryDisabled',
  ],
  announcements: ['SystemAnnouncementSent'],
};

/**
 * The audit log: every admin decision, newest first, with who made it. A table disabled or a player
 * removed counts when someone other than the table's GM did it (an admin, or a suspension). Events
 * are pruned after their retention, so this covers that window. `null` past the last page. The
 * decisions can be narrowed to a kind and to what an admin typed: who decided, the table or the name.
 */
export async function auditLog(db: AnyDb, actor: Actor | null, params: URLSearchParams) {
  authorize(actor, 'moderation:manage');
  const filters = auditFilters(params);
  const byOther = and(
    isNotNull(events.actorId),
    ne(events.actorId, gameTables.gmId),
    or(
      eq(events.type, 'TableDisabled'),
      and(eq(events.type, 'PlayerLeft'), sql`${events.payload}->>'reason' = 'removed'`),
    ),
  );
  const tableOf = sql`(${events.payload}->>'tableId')::uuid`;
  const actorProfile = alias(profiles, 'actor');
  const search = filters.query.replace(/^@/, '').replace(/[\\%_]/g, '\\$&');
  const kinds = filters.kind === 'all' ? null : AUDIT_KIND_TYPES[filters.kind];
  const where = and(
    or(inArray(events.type, [...AUDIT_EVENT_TYPES]), byOther),
    kinds ? inArray(events.type, [...kinds]) : undefined,
    search
      ? or(
          ilike(actorProfile.username, `%${search}%`),
          ilike(gameTables.title, `%${search}%`),
          sql`${events.payload}->>'name' ilike ${`%${search}%`}`,
          sql`${events.payload}->>'title' ilike ${`%${search}%`}`,
        )
      : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(events)
    .leftJoin(gameTables, eq(gameTables.id, tableOf))
    .leftJoin(actorProfile, eq(actorProfile.id, events.actorId))
    .where(where);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      payload: events.payload,
      at: events.createdAt,
      by: actorProfile.username,
      table: gameTables.title,
    })
    .from(events)
    .leftJoin(gameTables, eq(gameTables.id, tableOf))
    .leftJoin(actorProfile, eq(actorProfile.id, events.actorId))
    .where(where)
    .orderBy(desc(events.createdAt), desc(events.id))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  // Name the profiles the payloads point at (the suspended account, the removed player).
  const ids = [
    ...new Set(
      rows.flatMap((row) => {
        const payload = row.payload as Record<string, unknown>;
        return [payload.profileId, payload.playerId].filter(
          (value): value is string => typeof value === 'string',
        );
      }),
    ),
  ];
  const names = new Map(
    ids.length
      ? (
          await db
            .select({ id: profiles.id, username: profiles.username })
            .from(profiles)
            .where(inArray(profiles.id, ids))
        ).map((profile) => [profile.id, profile.username])
      : [],
  );

  return {
    rows: rows.map(({ payload, ...row }) => {
      const facts = payload as Record<string, unknown>;
      const subjectId = (facts.profileId ?? facts.playerId) as string | undefined;
      return {
        ...row,
        type: row.type as EventType,
        subject: subjectId ? (names.get(subjectId) ?? null) : null,
        name: typeof facts.name === 'string' ? facts.name : null,
        title: typeof facts.title === 'string' ? facts.title : null,
        reportId: typeof facts.reportId === 'string' ? facts.reportId : null,
        eventType: typeof facts.eventType === 'string' ? facts.eventType : null,
      };
    }),
    total,
    pages,
    ...filters,
  };
}

export type AuditLog = NonNullable<Awaited<ReturnType<typeof auditLog>>>;
