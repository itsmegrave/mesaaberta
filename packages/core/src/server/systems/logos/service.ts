import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AnyDb } from '../../db/client';
import { systemLogos, systems } from '../../db/schema';
import { authorize, type Actor } from '../../auth/policy';
import { Invalid } from '../../errors';
import { isInside } from '../../storage';
import { LOGO_STATUSES, type LogoStatus } from '../../../admin/system-logos';

/** The folder of the table-images bucket the logos live in. */
export const LOGO_FOLDER = 'systems';
export const LOGO_QUEUE_PAGE_SIZE = 30;
/** How many systems one search request looks at, so each stays well inside a Worker's limits. */
export const LOGO_SEARCH_BATCH = 5;

const url = z.url({ protocol: /^https$/ }).max(2_000);
const text = (max: number) => z.string().trim().max(max).nullable();

/** What the web Worker sends after a search of one system: what it stored, or why nothing. */
export const recordSchema = z.object({
  systemId: z.uuid(),
  found: z
    .object({
      path: z.string().max(200),
      method: z.enum(['wikidata', 'commons', 'website', 'wikipedia', 'logodev']),
      confidence: z.enum(['high', 'medium', 'low']),
      imageUrl: url,
      sourcePage: url,
      attribution: text(500),
      license: text(200),
      note: text(500),
      wikidataId: text(20),
    })
    .nullable(),
  /** Why there is nothing, when `found` is null. */
  reason: text(200),
  wikidataId: text(20),
});
/** A logo an admin sent by hand, already stored by the web Worker. Approved as it is sent. */
export const uploadSchema = z.object({
  systemId: z.uuid(),
  path: z.string().max(200),
  sourcePage: url,
  attribution: text(500),
});
export const decisionSchema = z.object({ systemId: z.uuid() });

const checkPath = (path: string) => {
  if (!isInside(path, LOGO_FOLDER)) throw new Invalid('path', 'invalid');
};

/**
 * The approved systems the search has not looked at yet, first in the source list's order (the
 * most played first), at most `limit`.
 */
export async function systemsToSearch(db: AnyDb, actor: Actor, limit = LOGO_SEARCH_BATCH) {
  authorize(actor, 'admin:access');
  return nextSystemsToSearch(db, limit);
}

/**
 * `systemsToSearch` without an actor, for the background search (the worker's cron), which acts
 * for no one. Never reachable from a request.
 */
export async function nextSystemsToSearch(db: AnyDb, limit = LOGO_SEARCH_BATCH) {
  return db
    .select({ id: systems.id, name: systems.name, slug: systems.slug })
    .from(systems)
    .leftJoin(systemLogos, eq(systemLogos.systemId, systems.id))
    .where(and(eq(systems.status, 'approved'), isNull(systemLogos.systemId)))
    .orderBy(asc(systems.position), asc(systems.name))
    .limit(Math.max(1, Math.min(limit, 20)));
}

/**
 * The admin's review list for one status, with how many systems each status has and how many the
 * search has not looked at. Null for a page past the last.
 */
export async function listSystemLogos(
  db: AnyDb,
  actor: Actor,
  { status, page }: { status: LogoStatus; page: number },
) {
  authorize(actor, 'admin:access');
  const counted = await db
    .select({ status: systemLogos.status, total: count() })
    .from(systemLogos)
    .innerJoin(systems, eq(systems.id, systemLogos.systemId))
    .where(eq(systems.status, 'approved'))
    .groupBy(systemLogos.status);
  const counts = Object.fromEntries(LOGO_STATUSES.map((s) => [s, 0])) as Record<LogoStatus, number>;
  for (const row of counted) counts[row.status] = row.total;
  const [{ total: approvedSystems }] = await db
    .select({ total: count() })
    .from(systems)
    .where(eq(systems.status, 'approved'));
  const searched = LOGO_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const pages = Math.max(1, Math.ceil(counts[status] / LOGO_QUEUE_PAGE_SIZE));
  if (page > pages) return null;
  const rows = await db
    .select({
      systemId: systems.id,
      name: systems.name,
      slug: systems.slug,
      status: systemLogos.status,
      path: systemLogos.path,
      method: systemLogos.method,
      confidence: systemLogos.confidence,
      imageUrl: systemLogos.imageUrl,
      sourcePage: systemLogos.sourcePage,
      attribution: systemLogos.attribution,
      license: systemLogos.license,
      note: systemLogos.note,
      wikidataId: systemLogos.wikidataId,
      updatedAt: systemLogos.updatedAt,
    })
    .from(systemLogos)
    .innerJoin(systems, eq(systems.id, systemLogos.systemId))
    .where(and(eq(systems.status, 'approved'), eq(systemLogos.status, status)))
    .orderBy(
      // The surest finds first, so a reviewer can approve the easy ones quickly.
      sql`case ${systemLogos.confidence} when 'high' then 0 when 'medium' then 1 when 'low' then 2 else 3 end`,
      asc(systems.position),
      asc(systems.name),
    )
    .limit(LOGO_QUEUE_PAGE_SIZE)
    .offset((page - 1) * LOGO_QUEUE_PAGE_SIZE);

  return {
    counts,
    unsearched: Math.max(0, approvedSystems - searched),
    pages,
    logos: rows,
  };
}

export type SystemLogoList = NonNullable<Awaited<ReturnType<typeof listSystemLogos>>>;

/**
 * Records what the search found for one system: a `pending` logo, or `missing`. A system that
 * already has a row keeps it (the search only looks at systems without one, so this is a race),
 * and the answer says the stored file is not used: `{ unused: path }` for the caller to delete.
 */
export async function recordLogoSearch(
  db: AnyDb,
  actor: Actor,
  data: z.infer<typeof recordSchema>,
): Promise<{ unused: string | null }> {
  authorize(actor, 'admin:access');
  return recordSearch(db, data);
}

/** `recordLogoSearch` without an actor, for the background search. Never reachable from a request. */
export async function recordSearch(
  db: AnyDb,
  data: z.infer<typeof recordSchema>,
): Promise<{ unused: string | null }> {
  if (data.found) checkPath(data.found.path);
  const row = data.found
    ? { status: 'pending' as const, ...data.found }
    : {
        status: 'missing' as const,
        note: data.reason,
        wikidataId: data.wikidataId,
      };
  const inserted = await db
    .insert(systemLogos)
    .values({ systemId: data.systemId, ...row })
    .onConflictDoNothing()
    .returning({ systemId: systemLogos.systemId });
  return { unused: inserted.length === 0 ? (data.found?.path ?? null) : null };
}

/** An admin's own logo for a system, approved at once. Answers the file it replaced. */
export async function uploadLogo(
  db: AnyDb,
  actor: Actor,
  data: z.infer<typeof uploadSchema>,
): Promise<{ replaced: string | null }> {
  authorize(actor, 'admin:access');
  checkPath(data.path);
  const [system] = await db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.id, data.systemId));
  if (!system) throw new Invalid('systemId', 'not_found');
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ path: systemLogos.path })
      .from(systemLogos)
      .where(eq(systemLogos.systemId, data.systemId))
      .for('update');
    const values = {
      status: 'approved' as const,
      path: data.path,
      method: 'upload',
      confidence: null,
      imageUrl: null,
      sourcePage: data.sourcePage,
      attribution: data.attribution || null,
      license: null,
      note: null,
      reviewedBy: actor.id,
      reviewedAt: new Date(),
    };
    await tx
      .insert(systemLogos)
      .values({ systemId: data.systemId, ...values })
      .onConflictDoUpdate({
        target: systemLogos.systemId,
        set: { ...values, updatedAt: new Date() },
      });
    return { replaced: before?.path && before.path !== data.path ? before.path : null };
  });
}

/** Approves a pending logo. */
export async function approveLogo(db: AnyDb, actor: Actor, systemId: string) {
  authorize(actor, 'admin:access');
  const updated = await db
    .update(systemLogos)
    .set({
      status: 'approved',
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(systemLogos.systemId, systemId), eq(systemLogos.status, 'pending')))
    .returning({ systemId: systemLogos.systemId });
  if (updated.length === 0) throw new Invalid('systemId', 'not_pending');
  return { approved: updated.length };
}

/** Approves every pending logo the search was sure of (`high`): one exact Wikidata match each. */
export async function approveSureLogos(db: AnyDb, actor: Actor) {
  authorize(actor, 'admin:access');
  const updated = await db
    .update(systemLogos)
    .set({
      status: 'approved',
      reviewedBy: actor.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(systemLogos.status, 'pending'), eq(systemLogos.confidence, 'high')))
    .returning({ systemId: systemLogos.systemId });
  return { approved: updated.length };
}

/**
 * Rejects a logo (pending or approved): its source stays, so the reviewer knows it was looked at,
 * and its file is answered for the caller to delete.
 */
export async function rejectLogo(db: AnyDb, actor: Actor, systemId: string) {
  authorize(actor, 'admin:access');
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select({ path: systemLogos.path, status: systemLogos.status })
      .from(systemLogos)
      .where(eq(systemLogos.systemId, systemId))
      .for('update');
    if (!before || (before.status !== 'pending' && before.status !== 'approved'))
      throw new Invalid('systemId', 'not_found');
    await tx
      .update(systemLogos)
      .set({
        status: 'rejected',
        path: null,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(systemLogos.systemId, systemId));
    return { removed: before.path };
  });
}

/**
 * Forgets every system the search found nothing for, so the next search looks at them again (after
 * the finder learns a new source). They have no file to delete.
 */
export async function forgetMissingLogos(db: AnyDb, actor: Actor) {
  authorize(actor, 'admin:access');
  const deleted = await db
    .delete(systemLogos)
    .where(eq(systemLogos.status, 'missing'))
    .returning({ systemId: systemLogos.systemId });
  return { forgotten: deleted.length };
}

/** Forgets what the search found for a system, so the next search looks at it again. */
export async function forgetLogo(db: AnyDb, actor: Actor, systemId: string) {
  authorize(actor, 'admin:access');
  const [deleted] = await db
    .delete(systemLogos)
    .where(eq(systemLogos.systemId, systemId))
    .returning({ path: systemLogos.path });
  return { removed: deleted?.path ?? null };
}
