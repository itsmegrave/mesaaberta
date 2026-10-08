import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../../db/client';
import { crowdfundings, crowdfundingImports, crowdfundingImportRuns } from '../../db/schema';
import { recordEvent } from '../../events/outbox';
import { platformOf } from '../../../crowdfunding/platforms';
import { campaignUrlAliases, validateCandidate } from './candidate';
import type { ImportSource, SourceCandidate } from './types';
export async function lockCampaignUrl(db: AnyDb, url: string) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`crowdfunding-url:${campaignUrlAliases(url)[0] ?? url}`},0))`,
  );
}
export async function importCandidate(
  db: AnyDb,
  candidate: SourceCandidate,
  { now = new Date() }: { now?: Date } = {},
): Promise<'imported' | 'existing' | 'suppressed'> {
  const c = validateCandidate(candidate, now);
  if (!c) throw new Error('candidate_invalid');
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await t.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`crowdfunding-source:${c.source}:${c.externalId}`},0))`,
    );
    await lockCampaignUrl(t, c.url);
    const [mapping] = await t
      .select()
      .from(crowdfundingImports)
      .where(
        and(
          eq(crowdfundingImports.source, c.source),
          eq(crowdfundingImports.externalId, c.externalId),
        ),
      );
    if (mapping) {
      const [row] = await t
        .select({ removedAt: crowdfundings.removedAt })
        .from(crowdfundings)
        .where(eq(crowdfundings.id, mapping.crowdfundingId))
        .for('update');
      return row.removedAt ? 'suppressed' : 'existing';
    }
    const existing = await t
      .select()
      .from(crowdfundings)
      .where(inArray(crowdfundings.url, campaignUrlAliases(c.url)))
      .orderBy(desc(crowdfundings.removedAt))
      .for('update');
    let row = existing[0],
      imported = false;
    if (!row) {
      [row] = await t
        .insert(crowdfundings)
        .values({
          origin: 'import',
          importSource: c.source,
          submitterId: null,
          url: c.url,
          platform: platformOf(c.url),
          name: c.name,
          owner: c.owner,
          startsOn: c.startsOn,
          endsOn: c.endsOn,
          createdAt: now,
        })
        .returning();
      imported = true;
      await recordEvent(
        t,
        {
          type: 'CrowdfundingImported',
          actorId: null,
          payload: {
            crowdfundingId: row.id,
            name: c.name,
            source: c.source,
            externalId: c.externalId,
          },
        },
        { now },
      );
    }
    await t.insert(crowdfundingImports).values({
      source: c.source,
      externalId: c.externalId,
      crowdfundingId: row.id,
      canonicalUrl: c.url,
      firstSeenAt: now,
    });
    return row.removedAt ? 'suppressed' : imported ? 'imported' : 'existing';
  });
}
export type RunLease = {
  source: ImportSource;
  runDate: string;
  token: string;
  cursor: string | null;
};
/** A source/date claim is atomic; network work never holds a database transaction open. */
export async function claimRun(
  db: AnyDb,
  source: ImportSource,
  runDate: string,
  now: Date,
): Promise<RunLease | null> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    await t.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`crowdfunding-run:${source}`},0))`,
    );
    const [latest] = await t
      .select()
      .from(crowdfundingImportRuns)
      .where(eq(crowdfundingImportRuns.source, source))
      .orderBy(desc(crowdfundingImportRuns.runDate))
      .limit(1);
    if (
      latest &&
      (latest.runDate > runDate ||
        (latest.status === 'running' && latest.leaseUntil > now) ||
        (latest.runDate === runDate && latest.status !== 'running'))
    )
      return null;
    const cursor = latest?.status !== 'complete' ? (latest?.cursor ?? null) : null;
    const token = crypto.randomUUID();
    await t
      .insert(crowdfundingImportRuns)
      .values({
        source,
        runDate,
        token,
        cursor,
        status: 'running',
        startedAt: now,
        leaseUntil: new Date(+now + 9 * 60_000),
      })
      .onConflictDoUpdate({
        target: [crowdfundingImportRuns.source, crowdfundingImportRuns.runDate],
        set: {
          token,
          cursor,
          status: 'running',
          startedAt: now,
          finishedAt: null,
          errorCode: null,
          leaseUntil: new Date(+now + 9 * 60_000),
        },
      });
    return { source, runDate, token, cursor };
  });
}
export async function finishRun(
  db: AnyDb,
  lease: RunLease,
  status: 'complete' | 'partial' | 'failed',
  cursor: string | null,
  counters: Record<string, number>,
  now: Date,
  errorCode: string | null = null,
): Promise<boolean> {
  const rows = await db
    .update(crowdfundingImportRuns)
    .set({ status, cursor, counters, finishedAt: now, leaseUntil: now, errorCode })
    .where(
      and(
        eq(crowdfundingImportRuns.source, lease.source),
        eq(crowdfundingImportRuns.runDate, lease.runDate),
        eq(crowdfundingImportRuns.token, lease.token),
        eq(crowdfundingImportRuns.status, 'running'),
      ),
    )
    .returning({ token: crowdfundingImportRuns.token });
  return rows.length === 1;
}
export async function checkpointRun(
  db: AnyDb,
  lease: RunLease,
  cursor: string,
  counters: Record<string, number>,
): Promise<boolean> {
  const rows = await db
    .update(crowdfundingImportRuns)
    .set({ cursor, counters })
    .where(
      and(
        eq(crowdfundingImportRuns.source, lease.source),
        eq(crowdfundingImportRuns.runDate, lease.runDate),
        eq(crowdfundingImportRuns.token, lease.token),
        eq(crowdfundingImportRuns.status, 'running'),
      ),
    )
    .returning({ token: crowdfundingImportRuns.token });
  return rows.length === 1;
}
