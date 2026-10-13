import { and, asc, eq, or } from 'drizzle-orm';
import type { AnyDb } from './db/client';
import { systems } from './db/schema';

/**
 * The approved RPG systems, most played first and then A to Z (the seeded order). Use it wherever
 * a system is chosen, filtered or shown, so nothing keeps its own list. With `suggestedBy`, that
 * GM's own pending suggestions come too, marked `pending` (the table form offers them to them).
 */
export async function listSystems(db: AnyDb, { suggestedBy }: { suggestedBy?: string } = {}) {
  const rows = await db
    .select({ name: systems.name, slug: systems.slug, status: systems.status })
    .from(systems)
    .where(
      suggestedBy
        ? or(
            eq(systems.status, 'approved'),
            and(eq(systems.status, 'pending'), eq(systems.suggestedBy, suggestedBy)),
          )
        : eq(systems.status, 'approved'),
    )
    .orderBy(asc(systems.position), asc(systems.name));
  return rows.map(({ name, slug, status }) =>
    status === 'pending' ? { name, slug, pending: true as const } : { name, slug },
  );
}

/** Where the system of a table stands, for the notice a draft shows while its system waits. */
export async function systemOfTable(db: AnyDb, systemSlug: string) {
  const [system] = await db
    .select({ name: systems.name, status: systems.status })
    .from(systems)
    .where(eq(systems.slug, systemSlug));
  return system ?? null;
}

/** The system of a draft when it keeps the draft from being published: a suggestion, or one turned down. */
export async function systemWaitingOf(db: AnyDb, systemSlug: string) {
  const system = await systemOfTable(db, systemSlug);
  return system && (system.status === 'pending' || system.status === 'rejected')
    ? { name: system.name, status: system.status }
    : null;
}

/** The approved system behind a slug in a URL, or null so the page can answer 404. */
export async function findSystemBySlug(db: AnyDb, slug: string) {
  const [system] = await db
    .select()
    .from(systems)
    .where(and(eq(systems.slug, slug), eq(systems.status, 'approved')));

  return system ?? null;
}
