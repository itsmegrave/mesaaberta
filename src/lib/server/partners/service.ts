import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { PARTNER_PAGE_SIZE, type PartnerFilters } from '$lib/partners/filters';
import { partnerLinks, type PartnerInput } from '$lib/partners/schema';
import type { PartnerReportInput } from '$lib/moderation/reports';
import { parseSocialUrl, type Network } from '$lib/profile/social-links';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { partnerLinks as partnerLinksTable, partners, reports } from '../db/schema';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import type { Changes } from '../events/types';
import { enforceRateLimit, REPORT_LIMIT } from '../rate-limit';
import { resolveOpenPartnerReports } from './admin';

// The member side of the partners (link exchange) page. A partner is sent by a member, waits for an
// admin (`approvedAt`), and is then public. Editing it clears the approval again. The submitter is
// never part of what the public list returns to a page: only whether the viewer is them.

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/** The address to store for an optional field: the normalised link, or null when left empty. */
const addressOrNull = (raw: string) => (raw.trim() === '' ? null : parseSocialUrl(raw));
const textOrNull = (raw: string) => (raw.trim() === '' ? null : raw.trim());

/** The columns an add or an edit writes, from a validated form. */
function columnsOf(input: PartnerInput) {
  return {
    name: input.name,
    description: textOrNull(input.description),
    contactEmail: textOrNull(input.contactEmail),
    siteUrl: addressOrNull(input.siteUrl),
    backlinkUrl: addressOrNull(input.backlinkUrl),
    couponCode: textOrNull(input.couponCode),
    couponDescription: input.couponCode.trim() === '' ? null : textOrNull(input.couponDescription),
  };
}

async function writeLinks(db: AnyDb, partnerId: string, input: PartnerInput) {
  await db.delete(partnerLinksTable).where(eq(partnerLinksTable.partnerId, partnerId));
  const links = partnerLinks(input);
  if (links.length === 0) return;
  await db
    .insert(partnerLinksTable)
    .values(links.map((link, position) => ({ partnerId, position, ...link })));
}

/**
 * A member sends a partner: it waits for an admin, credited to them (only admins see who). Returns
 * the `PartnerAdded` event to dispatch.
 */
export async function addPartner(
  db: AnyDb,
  actor: Actor | null,
  input: PartnerInput,
  { logoPath, now = new Date() }: { logoPath: string; now?: Date },
): Promise<{ id: string; eventId: string }> {
  authorize(actor, 'partner:add');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [row] = await t
      .insert(partners)
      .values({ submitterId: actor!.id, logoPath, ...columnsOf(input), createdAt: now })
      .returning({ id: partners.id });
    await writeLinks(t, row.id, input);
    const eventId = await recordEvent(
      t,
      {
        type: 'PartnerAdded',
        actorId: actor!.id,
        payload: { partnerId: row.id, name: input.name },
      },
      { now },
    );
    return { id: row.id, eventId };
  });
}

/** A partner as the edit form needs it. Only its submitter may open it; a removed one is gone. */
export async function findOwnPartner(db: AnyDb, actor: Actor | null, id: string) {
  const [row] = await db
    .select()
    .from(partners)
    .where(and(eq(partners.id, id), isNull(partners.removedAt)));
  if (!row) throw new NotFound(`no partner "${id}"`);
  authorize(actor, 'partner:edit', { submitterId: row.submitterId });
  const links = await db
    .select({ network: partnerLinksTable.network, url: partnerLinksTable.url })
    .from(partnerLinksTable)
    .where(eq(partnerLinksTable.partnerId, id))
    .orderBy(asc(partnerLinksTable.position));
  return { ...row, links: links as { network: Exclude<Network, 'website'>; url: string }[] };
}

/**
 * The submitter edits their partner. Any edit sends it back to review: it leaves the public list
 * until an admin approves it again, so a link cannot be swapped after approval. A new logo replaces
 * the old one; the replaced path is returned so the caller can delete that file. Returns the
 * `PartnerUpdated` event to dispatch.
 */
export async function updatePartner(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  input: PartnerInput,
  { logoPath = null, now = new Date() }: { logoPath?: string | null; now?: Date } = {},
): Promise<{ eventId: string; replacedLogo: string | null }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [current] = await t
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), isNull(partners.removedAt)))
      .for('update');
    if (!current) throw new NotFound(`no partner "${id}"`);
    authorize(actor, 'partner:edit', { submitterId: current.submitterId });

    const next = columnsOf(input);
    const oldLinks = await t
      .select({ url: partnerLinksTable.url })
      .from(partnerLinksTable)
      .where(eq(partnerLinksTable.partnerId, id))
      .orderBy(asc(partnerLinksTable.position));

    const changes: Changes = {};
    for (const key of Object.keys(next) as (keyof typeof next)[]) {
      if (next[key] === current[key]) continue;
      // An address is personal data: the audit event says it changed, never what it was.
      changes[key] =
        key === 'contactEmail' ? { redacted: true } : { from: current[key], to: next[key] };
    }
    const links = partnerLinks(input).map((link) => link.url);
    if (links.join('\n') !== oldLinks.map((link) => link.url).join('\n')) {
      changes.links = { from: oldLinks.length, to: links.length };
    }
    if (logoPath) changes.logo = { redacted: true };

    await t
      .update(partners)
      .set({
        ...next,
        ...(logoPath ? { logoPath } : {}),
        approvedAt: null,
        approvedBy: null,
        updatedAt: now,
      })
      .where(eq(partners.id, id));
    await writeLinks(t, id, input);

    const eventId = await recordEvent(
      t,
      {
        type: 'PartnerUpdated',
        actorId: actor!.id,
        payload: { partnerId: id, name: input.name, changes },
      },
      { now },
    );
    return { eventId, replacedLogo: logoPath ? current.logoPath : null };
  });
}

/**
 * The submitter takes their partner off. Open reports about it are accepted (each reporter hears
 * it was looked at). Returns the events to dispatch. Nobody is told: they did it themselves.
 */
export async function withdrawPartner(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [partner] = await t
      .select()
      .from(partners)
      .where(and(eq(partners.id, id), isNull(partners.removedAt)))
      .for('update');
    if (!partner) throw new NotFound(`no partner "${id}"`);
    authorize(actor, 'partner:edit', { submitterId: partner.submitterId });

    await t
      .update(partners)
      .set({ removedAt: now, removedBy: actor!.id, removalReason: null, removalNote: null })
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
            reason: null,
            reportId: null,
          },
        },
        { now },
      ),
    );
    return eventIds;
  });
}

export type PartnerCard = {
  id: string;
  name: string;
  description: string | null;
  logoPath: string;
  siteUrl: string | null;
  couponCode: string | null;
  couponDescription: string | null;
  /** Waiting for an admin: only its submitter sees it, with an "Em análise" badge. */
  pending: boolean;
  /** Server only: the page turns it into `canEdit` and never sends it. */
  submitterId: string;
  links: { network: Exclude<Network, 'website'>; url: string }[];
};

/**
 * The public list: approved partners that were not removed, plus the viewer's own that wait for
 * review. A `page` past the last is `null`, so the route answers 404 (the first page always
 * exists, even empty).
 */
export async function listPartners(
  db: AnyDb,
  filters: PartnerFilters,
  { viewerId = null }: { viewerId?: string | null } = {},
) {
  const needle = filters.query ? `%${escapeLike(filters.query)}%` : null;
  const where = and(
    isNull(partners.removedAt),
    viewerId
      ? or(isNotNull(partners.approvedAt), eq(partners.submitterId, viewerId))
      : isNotNull(partners.approvedAt),
    needle ? or(ilike(partners.name, needle), ilike(partners.description, needle)) : undefined,
  );

  const [{ total }] = await db.select({ total: count() }).from(partners).where(where);
  const pages = Math.max(1, Math.ceil(total / PARTNER_PAGE_SIZE));
  if (filters.page > pages) return null;

  const rows = await db
    .select({
      id: partners.id,
      name: partners.name,
      description: partners.description,
      logoPath: partners.logoPath,
      siteUrl: partners.siteUrl,
      couponCode: partners.couponCode,
      couponDescription: partners.couponDescription,
      pending: sql<boolean>`${partners.approvedAt} IS NULL`,
      submitterId: partners.submitterId,
    })
    .from(partners)
    .where(where)
    .orderBy(
      filters.sort === 'name' ? asc(sql`lower(${partners.name})`) : desc(partners.createdAt),
      desc(partners.id),
    )
    .limit(PARTNER_PAGE_SIZE)
    .offset((filters.page - 1) * PARTNER_PAGE_SIZE);

  const links = rows.length
    ? await db
        .select({
          partnerId: partnerLinksTable.partnerId,
          network: partnerLinksTable.network,
          url: partnerLinksTable.url,
        })
        .from(partnerLinksTable)
        .where(
          inArray(
            partnerLinksTable.partnerId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(partnerLinksTable.position))
    : [];

  const cards: PartnerCard[] = rows.map((row) => ({
    ...row,
    links: links
      .filter((link) => link.partnerId === row.id)
      .map(({ network, url }) => ({ network: network as Exclude<Network, 'website'>, url })),
  }));
  return { cards, total, pages };
}

export type PartnerList = NonNullable<Awaited<ReturnType<typeof listPartners>>>;

/** Whether the partner is on the page (approved and not removed), and who sent it. */
export async function findListed(db: AnyDb, id: string) {
  const [row] = await db
    .select({ id: partners.id, submitterId: partners.submitterId, name: partners.name })
    .from(partners)
    .where(and(eq(partners.id, id), isNotNull(partners.approvedAt), isNull(partners.removedAt)));
  return row ?? null;
}

/**
 * A member reports a partner that is on the page. Refused for one's own, while the same report
 * still waits on an admin (`already_reported`) and past REPORT_LIMIT. The reporter stays anonymous.
 * Returns the `ReportFiled` event to dispatch.
 */
export async function filePartnerReport(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  input: PartnerReportInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventId: string }> {
  const partner = await findListed(db, id);
  if (!partner) throw new NotFound(`no partner "${id}"`);
  authorize(actor, 'partner:report', { submitterId: partner.submitterId });

  const eventId = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actor!.id, REPORT_LIMIT, now);
    const [report] = await t
      .insert(reports)
      .values({
        reporterId: actor!.id,
        targetType: 'partner',
        targetId: partner.id,
        tableId: null,
        reason: input.reason,
        details: input.details,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: reports.id });
    if (!report) throw new Invalid('', 'already_reported');

    return recordEvent(
      t,
      {
        type: 'ReportFiled',
        actorId: actor!.id,
        payload: {
          reportId: report.id,
          targetType: 'partner',
          targetId: partner.id,
          tableId: null,
          reason: input.reason,
        },
      },
      { now },
    );
  });
  return { eventId };
}
