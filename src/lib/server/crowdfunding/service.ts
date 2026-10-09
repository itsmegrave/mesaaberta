import {
  type AnyColumn,
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  sql,
  lt,
  lte,
  or,
} from 'drizzle-orm';
import { CROWDFUNDING_PAGE_SIZE, type CrowdfundingFilters } from '$lib/crowdfunding/filters';
import { todayIn } from '$lib/crowdfunding/phase';
import { platformOf } from '$lib/crowdfunding/platforms';
import type { CrowdfundingFormInput } from '$lib/crowdfunding/schema';
import { normalizeCampaignUrl } from '$lib/crowdfunding/url';
import type { CrowdfundingReportInput } from '$lib/moderation/reports';
import { authorize, type Actor } from '../auth/policy';
import type { AnyDb } from '../db/client';
import { publicName } from '../db/public-name';
import { crowdfundings, profiles, reports } from '../db/schema';
import { campaignUrlAliases } from './import/candidate';
import { lockCampaignUrl } from './import/store';
import { Invalid, NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { CROWDFUNDING_LIMIT, enforceRateLimit, LINK_READ_LIMIT, REPORT_LIMIT } from '../rate-limit';

export type CrowdfundingInput = Omit<CrowdfundingFormInput, 'image'>;

/**
 * Takes one of a member's link reads before the server fetches an address for them, under a lock,
 * so simultaneous requests cannot all slip through. Every path that fetches a member's link (the
 * preview endpoint and the add form) goes through here. Throws `RateLimited` past LINK_READ_LIMIT.
 */
export async function takeLinkRead(
  db: AnyDb,
  actorId: string,
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actorId, LINK_READ_LIMIT, now);
    await recordEvent(t, { type: 'CrowdfundingLinkRead', actorId, payload: {} }, { now });
  });
}

/**
 * A member adds a campaign: public at once, credited to them, its platform read from the link.
 * The link is stored in its canonical form, so the one that was checked is the one that opens. A
 * link that is already up is refused (`already_listed` on `url`). Counts against CROWDFUNDING_LIMIT.
 * Returns the `CrowdfundingAdded` event to dispatch.
 */
export async function addCrowdfunding(
  db: AnyDb,
  actor: Actor | null,
  input: CrowdfundingInput,
  { imagePath = null, now = new Date() }: { imagePath?: string | null; now?: Date } = {},
): Promise<{ id: string; eventId: string }> {
  authorize(actor, 'crowdfunding:add');
  const url = normalizeCampaignUrl(input.url);
  if (!url) throw new Invalid('url', 'invalid_url');
  if (input.endsOn < input.startsOn) throw new Invalid('endsOn', 'before_start');

  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await lockCampaignUrl(t, url);
    const [existing] = await t
      .select({ id: crowdfundings.id })
      .from(crowdfundings)
      .where(
        and(inArray(crowdfundings.url, campaignUrlAliases(url)), isNull(crowdfundings.removedAt)),
      )
      .limit(1);
    if (existing) throw new Invalid('url', 'already_listed');
    await enforceRateLimit(t, actor!.id, CROWDFUNDING_LIMIT, now);
    const [row] = await t
      .insert(crowdfundings)
      .values({
        submitterId: actor!.id,
        url,
        platform: platformOf(url),
        name: input.name,
        owner: input.owner,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        imagePath,
        createdAt: now,
      })
      // The partial unique index: this link is already up.
      .onConflictDoNothing()
      .returning({ id: crowdfundings.id });
    if (!row) throw new Invalid('url', 'already_listed');

    const eventId = await recordEvent(
      t,
      {
        type: 'CrowdfundingAdded',
        actorId: actor!.id,
        payload: { crowdfundingId: row.id, name: input.name },
      },
      { now },
    );
    return { id: row.id, eventId };
  });
}

/** The campaign that is up at `url`, for the "already listed" answer to point at. */
export async function findListedByUrl(db: AnyDb, url: string) {
  const key = normalizeCampaignUrl(url);
  if (!key) return null;
  const [row] = await db
    .select({ id: crowdfundings.id, name: crowdfundings.name })
    .from(crowdfundings)
    .where(
      and(inArray(crowdfundings.url, campaignUrlAliases(key)), isNull(crowdfundings.removedAt)),
    );
  return row ?? null;
}

/** What the public list and the cards need of a campaign. */
const cardColumns = {
  id: crowdfundings.id,
  name: crowdfundings.name,
  owner: crowdfundings.owner,
  url: crowdfundings.url,
  platform: crowdfundings.platform,
  startsOn: crowdfundings.startsOn,
  endsOn: crowdfundings.endsOn,
  imagePath: crowdfundings.imagePath,
  submitterId: crowdfundings.submitterId,
  submitter: sql<
    string | null
  >`CASE WHEN ${crowdfundings.submitterId} IS NULL THEN NULL ELSE ${publicName(profiles.username)} END`,
  importSource: crowdfundings.importSource,
};

export type CrowdfundingCard = {
  id: string;
  name: string;
  owner: string;
  url: string;
  platform: (typeof crowdfundings.$inferSelect)['platform'];
  startsOn: string;
  endsOn: string;
  imagePath: string | null;
  submitterId: string | null;
  submitter: string | null;
  importSource: 'catarse' | 'meeplestarter' | null;
};

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/**
 * The public list. Without `ended`: the running campaigns (the ones ending soonest first) and the
 * ones that open soon, with how many have ended for the "Ver encerrados" link. With `ended`: one
 * page of the finished ones, latest first; a `page` past the last is `null`, so the route answers
 * 404 (the first page always exists, even empty). A removed campaign is never listed.
 */
export async function listCrowdfundings(
  db: AnyDb,
  filters: CrowdfundingFilters,
  { now = new Date() }: { now?: Date } = {},
) {
  const today = todayIn(now);
  const needle = filters.query ? `%${escapeLike(filters.query)}%` : null;
  const matching = and(
    isNull(crowdfundings.removedAt),
    needle ? or(ilike(crowdfundings.name, needle), ilike(crowdfundings.owner, needle)) : undefined,
  );
  const select = () =>
    db
      .select(cardColumns)
      .from(crowdfundings)
      .leftJoin(profiles, eq(profiles.id, crowdfundings.submitterId));

  const [{ ended }] = await db
    .select({ ended: count() })
    .from(crowdfundings)
    .where(and(matching, lt(crowdfundings.endsOn, today)));

  if (filters.ended) {
    const pages = Math.max(1, Math.ceil(ended / CROWDFUNDING_PAGE_SIZE));
    if (filters.page > pages) return null;
    const rows = await select()
      .where(and(matching, lt(crowdfundings.endsOn, today)))
      .orderBy(
        filters.sort === 'name' ? asc(crowdfundings.name) : desc(crowdfundings.endsOn),
        desc(crowdfundings.id),
      )
      .limit(CROWDFUNDING_PAGE_SIZE)
      .offset((filters.page - 1) * CROWDFUNDING_PAGE_SIZE);
    return {
      running: [],
      upcoming: [],
      ended: rows as CrowdfundingCard[],
      endedCount: ended,
      pages,
    };
  }

  const order = (soonest: AnyColumn) =>
    filters.sort === 'name'
      ? [asc(crowdfundings.name), asc(crowdfundings.id)]
      : filters.sort === 'newest'
        ? [desc(crowdfundings.createdAt), desc(crowdfundings.id)]
        : [asc(soonest), asc(crowdfundings.id)];
  const running = await select()
    .where(and(matching, lte(crowdfundings.startsOn, today), gte(crowdfundings.endsOn, today)))
    .orderBy(...order(crowdfundings.endsOn));
  const upcoming = await select()
    .where(and(matching, gt(crowdfundings.startsOn, today)))
    .orderBy(...order(crowdfundings.startsOn));
  return {
    running: running as CrowdfundingCard[],
    upcoming: upcoming as CrowdfundingCard[],
    ended: [],
    endedCount: ended,
    pages: 1,
  };
}

export type CrowdfundingList = NonNullable<Awaited<ReturnType<typeof listCrowdfundings>>>;

/** Whether the campaign is up (exists and was not removed), and who added it. */
export async function findLive(db: AnyDb, id: string) {
  const [row] = await db
    .select({
      id: crowdfundings.id,
      submitterId: crowdfundings.submitterId,
      name: crowdfundings.name,
    })
    .from(crowdfundings)
    .where(and(eq(crowdfundings.id, id), isNull(crowdfundings.removedAt)));
  return row ?? null;
}

/**
 * A member reports a campaign that is up. Refused for one's own, while the same report still waits
 * on an admin (`already_reported`) and past REPORT_LIMIT. The reporter stays anonymous. Returns the
 * `ReportFiled` event to dispatch.
 */
export async function fileCrowdfundingReport(
  db: AnyDb,
  actor: Actor | null,
  id: string,
  input: CrowdfundingReportInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventId: string }> {
  const campaign = await findLive(db, id);
  if (!campaign) throw new NotFound(`no crowdfunding "${id}"`);
  authorize(actor, 'crowdfunding:report', { submitterId: campaign.submitterId });

  const eventId = await db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await enforceRateLimit(t, actor!.id, REPORT_LIMIT, now);
    const [report] = await t
      .insert(reports)
      .values({
        reporterId: actor!.id,
        targetType: 'crowdfunding',
        targetId: campaign.id,
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
          targetType: 'crowdfunding',
          targetId: campaign.id,
          tableId: null,
          reason: input.reason,
        },
      },
      { now },
    );
  });
  return { eventId };
}
