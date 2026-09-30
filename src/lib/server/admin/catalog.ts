import { and, asc, count, desc, eq, ilike, inArray, ne, sql } from 'drizzle-orm';
import { slugify } from '$lib/slug';
import { SUGGESTION_NAME } from '$lib/tables/catalog';
import type { AnyDb } from '../db/client';
import {
  events,
  gameTablePlatforms,
  gameTableTags,
  gameTables,
  platforms,
  profiles,
  tags,
} from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { Invalid } from '../errors';
import { recordEvent } from '../events/outbox';
import type { CatalogDecision } from '../events/types';

export type CatalogKind = 'platform' | 'tag';
export const CATALOG_KINDS: readonly CatalogKind[] = ['platform', 'tag'];
export const CATALOG_PAGE_SIZE = 20;

const tableOf = (kind: CatalogKind) => (kind === 'platform' ? platforms : tags);
const linkOf = (kind: CatalogKind) => (kind === 'platform' ? gameTablePlatforms : gameTableTags);
const linkColumn = (kind: CatalogKind) =>
  kind === 'platform' ? gameTablePlatforms.platformId : gameTableTags.tagId;

const EVENTS = [
  'CatalogEntryCreated',
  'CatalogEntryApproved',
  'CatalogEntryRejected',
  'CatalogEntryRenamed',
  'CatalogEntryMerged',
  'CatalogEntryDisabled',
] as const;

/** The name as it is kept: single spaces, and long and short enough to be a real label. */
function cleanName(typed: string) {
  const name = typed.trim().replace(/\s+/g, ' ');
  const slug = slugify(name, { fallback: '' });
  if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max || !slug) {
    throw new Invalid('name', 'invalid');
  }
  return { name, slug };
}

const squash = (text: string) => slugify(text, { fallback: '' }).replace(/-/g, '');

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const kept = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = kept;
    }
  }
  return row[b.length];
}

/**
 * The approved entry a suggestion most likely repeats: the same word once spaces, dashes and
 * accents are ignored, one typo away, or one name inside the other ("Foundry" and "Foundry VTT").
 */
export function nearDuplicate<T extends { name: string }>(name: string, approved: readonly T[]) {
  const wanted = squash(name);
  if (!wanted) return null;
  return (
    approved.find((entry) => {
      const other = squash(entry.name);
      if (!other) return false;
      if (other === wanted) return true;
      const shortest = Math.min(other.length, wanted.length);
      if (shortest >= 4 && (other.includes(wanted) || wanted.includes(other))) return true;
      return shortest >= 5 && distance(other, wanted) <= 1;
    }) ?? null
  );
}

export type QueueEntry = {
  kind: CatalogKind;
  id: string;
  name: string;
  slug: string;
  suggestedBy: string | null;
  createdAt: Date;
  tables: { title: string; slug: string }[];
  duplicateOf: { id: string; name: string } | null;
};

/** The pending suggestions, oldest first: who suggested each, on which tables, and any near-duplicate. */
export async function listQueue(db: AnyDb): Promise<QueueEntry[]> {
  const entries: QueueEntry[] = [];
  for (const kind of CATALOG_KINDS) {
    const table = tableOf(kind);
    const link = linkOf(kind);
    const [pending, approved] = await Promise.all([
      db
        .select({
          id: table.id,
          name: table.name,
          slug: table.slug,
          createdAt: table.createdAt,
          suggestedBy: profiles.username,
        })
        .from(table)
        .leftJoin(profiles, eq(profiles.id, table.suggestedBy))
        .where(eq(table.status, 'pending'))
        .orderBy(asc(table.createdAt), asc(table.name)),
      db.select({ id: table.id, name: table.name }).from(table).where(eq(table.status, 'approved')),
    ]);
    const used =
      pending.length === 0
        ? []
        : await db
            .select({ entryId: linkColumn(kind), title: gameTables.title, slug: gameTables.slug })
            .from(link)
            .innerJoin(gameTables, eq(gameTables.id, link.tableId))
            .where(
              inArray(
                linkColumn(kind),
                pending.map((entry) => entry.id),
              ),
            )
            .orderBy(asc(gameTables.title));
    for (const entry of pending) {
      entries.push({
        kind,
        ...entry,
        tables: used
          .filter((row) => row.entryId === entry.id)
          .map(({ title, slug }) => ({ title, slug })),
        duplicateOf: nearDuplicate(entry.name, approved),
      });
    }
  }
  return entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** The approved entries of both kinds, for a merge to offer as its target. */
export async function listApproved(db: AnyDb) {
  const list = (kind: CatalogKind) => {
    const table = tableOf(kind);
    return db
      .select({ id: table.id, name: table.name })
      .from(table)
      .where(eq(table.status, 'approved'))
      .orderBy(asc(table.position), asc(table.name));
  };
  const [platform, tag] = await Promise.all([list('platform'), list('tag')]);
  return { platform, tag };
}

export type Decision = {
  id: string;
  type: (typeof EVENTS)[number];
  kind: CatalogKind;
  name: string;
  into: string | null;
  from: string | null;
  by: string | null;
  at: Date;
};

/** What the admins decided lately, newest first, read from the events outbox (the audit log). */
export async function recentDecisions(db: AnyDb, limit = 8): Promise<Decision[]> {
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      payload: events.payload,
      at: events.createdAt,
      by: profiles.username,
    })
    .from(events)
    .leftJoin(profiles, eq(profiles.id, events.actorId))
    .where(inArray(events.type, [...EVENTS]))
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows.map((row) => {
    const payload = row.payload as CatalogDecision & { into?: string; from?: string };
    return {
      id: row.id,
      type: row.type as Decision['type'],
      kind: payload.kind,
      name: payload.name,
      into: payload.into ?? null,
      from: payload.from ?? null,
      by: row.by,
      at: row.at,
    };
  });
}

export type CatalogRow = {
  id: string;
  name: string;
  slug: string;
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  suggestedBy: string | null;
  uses: number;
};

/**
 * One kind's entries for the admin catalog: with how many tables use each, and where it came from.
 * A page past the last comes back empty; the route answers it with a 404.
 */
export async function listCatalogAdmin(
  db: AnyDb,
  kind: CatalogKind,
  { query = '', page = 1 }: { query?: string; page?: number } = {},
): Promise<{ rows: CatalogRow[]; total: number; page: number; pages: number }> {
  const table = tableOf(kind);
  const link = linkOf(kind);
  const search = query.trim().replace(/[\\%_]/g, '\\$&');
  const where = and(
    ne(table.status, 'rejected'),
    search ? ilike(table.name, `%${search}%`) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(table).where(where);
  const pages = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const uses = db
    .select({ id: linkColumn(kind), uses: count().as('uses') })
    .from(link)
    .groupBy(linkColumn(kind))
    .as('uses');
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      slug: table.slug,
      status: table.status,
      suggestedBy: profiles.username,
      uses: sql<number>`coalesce(${uses.uses}, 0)::int`,
    })
    .from(table)
    .leftJoin(profiles, eq(profiles.id, table.suggestedBy))
    .leftJoin(uses, eq(uses.id, table.id))
    .where(where)
    .orderBy(asc(table.position), asc(table.name))
    .limit(CATALOG_PAGE_SIZE)
    .offset((page - 1) * CATALOG_PAGE_SIZE);
  return { rows, total, page, pages };
}

async function entry(db: AnyDb, kind: CatalogKind, id: string) {
  const table = tableOf(kind);
  const [row] = await db
    .select({ id: table.id, name: table.name, status: table.status })
    .from(table)
    .where(eq(table.id, id));
  if (!row) throw new Invalid('id', 'not_found');
  return row;
}

/** A new approved entry, added by an admin. */
export async function createEntry(
  db: AnyDb,
  actor: Actor | null,
  kind: CatalogKind,
  typed: string,
) {
  authorize(actor, 'admin:access');
  const { name, slug } = cleanName(typed);
  const table = tableOf(kind);
  return db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: table.id }).from(table).where(eq(table.slug, slug));
    if (taken) throw new Invalid('name', 'taken');
    const [row] = await tx
      .insert(table)
      .values({ name, slug, status: 'approved', reviewedBy: actor!.id, reviewedAt: new Date() })
      .returning({ id: table.id });
    return recordEvent(tx, {
      type: 'CatalogEntryCreated',
      actorId: actor!.id,
      payload: { kind, entryId: row.id, name },
    });
  });
}

/** Lets a suggestion into the catalog, for every GM to pick. */
export async function approveEntry(db: AnyDb, actor: Actor | null, kind: CatalogKind, id: string) {
  authorize(actor, 'admin:access');
  const table = tableOf(kind);
  return db.transaction(async (tx) => {
    const current = await entry(tx, kind, id);
    if (current.status !== 'pending') throw new Invalid('id', 'not_pending');
    await tx
      .update(table)
      .set({ status: 'approved', reviewedBy: actor!.id, reviewedAt: new Date() })
      .where(eq(table.id, id));
    return recordEvent(tx, {
      type: 'CatalogEntryApproved',
      actorId: actor!.id,
      payload: { kind, entryId: id, name: current.name },
    });
  });
}

/** Turns a suggestion down: the tables that had it lose it, and the GM cannot suggest it again. */
export async function rejectEntry(db: AnyDb, actor: Actor | null, kind: CatalogKind, id: string) {
  authorize(actor, 'admin:access');
  const table = tableOf(kind);
  const link = linkOf(kind);
  return db.transaction(async (tx) => {
    const current = await entry(tx, kind, id);
    if (current.status !== 'pending') throw new Invalid('id', 'not_pending');
    await tx.delete(link).where(eq(linkColumn(kind), id));
    await tx
      .update(table)
      .set({ status: 'rejected', reviewedBy: actor!.id, reviewedAt: new Date() })
      .where(eq(table.id, id));
    return recordEvent(tx, {
      type: 'CatalogEntryRejected',
      actorId: actor!.id,
      payload: { kind, entryId: id, name: current.name },
    });
  });
}

/** A new name for an entry; the slug follows it. Refused when another entry already has that slug. */
export async function renameEntry(
  db: AnyDb,
  actor: Actor | null,
  kind: CatalogKind,
  id: string,
  typed: string,
) {
  authorize(actor, 'admin:access');
  const { name, slug } = cleanName(typed);
  const table = tableOf(kind);
  return db.transaction(async (tx) => {
    const current = await entry(tx, kind, id);
    const [taken] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.slug, slug), ne(table.id, id)));
    if (taken) throw new Invalid('name', 'taken');
    await tx.update(table).set({ name, slug, updatedAt: new Date() }).where(eq(table.id, id));
    return recordEvent(tx, {
      type: 'CatalogEntryRenamed',
      actorId: actor!.id,
      payload: { kind, entryId: id, name, from: current.name },
    });
  });
}

/**
 * Folds a duplicate into another entry: its tables move to the target (once, in the same place),
 * and it stays as a rejected record pointing at the target.
 */
export async function mergeEntry(
  db: AnyDb,
  actor: Actor | null,
  kind: CatalogKind,
  fromId: string,
  toId: string,
) {
  authorize(actor, 'admin:access');
  if (fromId === toId) throw new Invalid('into', 'same');
  const table = tableOf(kind);
  const link = linkOf(kind);
  const column = linkColumn(kind);
  return db.transaction(async (tx) => {
    const from = await entry(tx, kind, fromId);
    const to = await entry(tx, kind, toId);
    if (to.status !== 'approved') throw new Invalid('into', 'not_approved');
    if (from.status === 'rejected') throw new Invalid('id', 'gone');

    const moving = await tx
      .select({ tableId: link.tableId, position: link.position })
      .from(link)
      .where(eq(column, fromId));
    const already = new Set(
      (await tx.select({ tableId: link.tableId }).from(link).where(eq(column, toId))).map(
        (row) => row.tableId,
      ),
    );
    await tx.delete(link).where(eq(column, fromId));
    const carried = moving.filter((row) => !already.has(row.tableId));
    if (carried.length > 0) {
      await tx
        .insert(link)
        .values(
          carried.map((row) =>
            kind === 'platform'
              ? { tableId: row.tableId, platformId: toId, position: row.position }
              : { tableId: row.tableId, tagId: toId, position: row.position },
          ),
        );
    }
    await tx
      .update(table)
      .set({ status: 'rejected', mergedInto: toId, reviewedBy: actor!.id, reviewedAt: new Date() })
      .where(eq(table.id, fromId));
    return recordEvent(tx, {
      type: 'CatalogEntryMerged',
      actorId: actor!.id,
      payload: { kind, entryId: fromId, name: from.name, into: to.name },
    });
  });
}

/**
 * Takes an entry out of the choice list. Tables that already have it keep it; nobody can pick it
 * for a new one.
 */
export async function disableEntry(db: AnyDb, actor: Actor | null, kind: CatalogKind, id: string) {
  authorize(actor, 'admin:access');
  const table = tableOf(kind);
  return db.transaction(async (tx) => {
    const current = await entry(tx, kind, id);
    if (current.status !== 'approved') throw new Invalid('id', 'not_approved');
    await tx
      .update(table)
      .set({ status: 'disabled', reviewedBy: actor!.id, reviewedAt: new Date() })
      .where(eq(table.id, id));
    return recordEvent(tx, {
      type: 'CatalogEntryDisabled',
      actorId: actor!.id,
      payload: { kind, entryId: id, name: current.name },
    });
  });
}

/** Pending suggestions waiting, for the admin tabs and the overview. */
export async function pendingCount(db: AnyDb) {
  const counts = await Promise.all(
    CATALOG_KINDS.map(async (kind) => {
      const table = tableOf(kind);
      const [{ total }] = await db
        .select({ total: count() })
        .from(table)
        .where(eq(table.status, 'pending'));
      return total;
    }),
  );
  return counts[0] + counts[1];
}
