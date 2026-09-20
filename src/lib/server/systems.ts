import { asc, eq } from 'drizzle-orm';
import type { AnyDb } from './db/client';
import { systems } from './db/schema';

/**
 * Every RPG system, most played first and then A to Z (the seeded order). Use it wherever a system
 * is chosen, filtered or shown, so nothing keeps its own list.
 */
export const listSystems = (db: AnyDb) => db.select().from(systems).orderBy(asc(systems.position));

/** The system behind a slug in a URL, or null so the page can answer 404. */
export async function findSystemBySlug(db: AnyDb, slug: string) {
	const [system] = await db.select().from(systems).where(eq(systems.slug, slug));

	return system ?? null;
}
