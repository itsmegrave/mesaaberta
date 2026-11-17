import { and, asc, count, eq, inArray, isNotNull, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { gameTables, places, profiles, systems } from '../db/schema';
import { RESERVED_USERNAMES } from '../../profile/username';
import { SITEMAP_MAX_PAGES, SITEMAP_PAGE_SIZE, type SitemapResource } from '../../seo/sitemap';

const publicTable = and(
  inArray(gameTables.status, ['active', 'awaiting_confirmation', 'concluded', 'not_held']),
  eq(systems.status, 'approved'),
  eq(profiles.status, 'active'),
  ne(gameTables.slug, 'new'),
);
const publicProfile = and(
  eq(profiles.status, 'active'),
  isNotNull(profiles.username),
  sql`length(${profiles.username}) between 3 and 30`,
  notInArray(profiles.username, [...RESERVED_USERNAMES]),
);
// The systems directory lists approved systems; a merged one redirects to the one it joined.
const publicSystem = and(eq(systems.status, 'approved'), isNull(systems.mergedInto));
// The places directory lists what an admin approved and nothing took down or hid.
const publicPlace = and(
  isNotNull(places.approvedAt),
  isNull(places.removedAt),
  isNull(places.hiddenAt),
);
async function pages(db: AnyDb, resource: SitemapResource) {
  const rows =
    resource === 'systems'
      ? await db.select({ total: count() }).from(systems).where(publicSystem)
      : resource === 'places'
        ? await db.select({ total: count() }).from(places).where(publicPlace)
        : resource === 'tables'
          ? await db
              .select({ total: count() })
              .from(gameTables)
              .innerJoin(systems, eq(gameTables.systemId, systems.id))
              .innerJoin(profiles, eq(gameTables.gmId, profiles.id))
              .where(publicTable)
          : await db.select({ total: count() }).from(profiles).where(publicProfile);
  const result = Math.ceil(rows[0].total / SITEMAP_PAGE_SIZE);
  if (result > SITEMAP_MAX_PAGES) throw new Error('Sitemap capacity exceeded');
  return result;
}
export async function sitemapIndex(db: AnyDb) {
  return {
    tables: await pages(db, 'tables'),
    profiles: await pages(db, 'profiles'),
    systems: await pages(db, 'systems'),
    places: await pages(db, 'places'),
  };
}
export async function sitemapPage(db: AnyDb, resource: SitemapResource, page: number) {
  if (page < 1 || page > (await pages(db, resource))) return null;
  const offset = (page - 1) * SITEMAP_PAGE_SIZE;
  // Select only published identifiers and authoritative modification dates, never private table fields.
  if (resource === 'tables') {
    const rows = await db
      .select({ slug: gameTables.slug, updatedAt: gameTables.updatedAt })
      .from(gameTables)
      .innerJoin(systems, eq(gameTables.systemId, systems.id))
      .innerJoin(profiles, eq(gameTables.gmId, profiles.id))
      .where(publicTable)
      .orderBy(asc(gameTables.slug))
      .limit(SITEMAP_PAGE_SIZE)
      .offset(offset);
    return {
      entries: rows.map(({ slug, updatedAt }) => ({ slug, lastmod: updatedAt.toISOString() })),
    };
  }
  if (resource === 'systems') {
    const rows = await db
      .select({ slug: systems.slug })
      .from(systems)
      .where(publicSystem)
      .orderBy(asc(systems.slug))
      .limit(SITEMAP_PAGE_SIZE)
      .offset(offset);
    // A system's page changes with its tables; the system row has no modification date.
    return { entries: rows };
  }
  if (resource === 'places') {
    const rows = await db
      .select({ slug: places.slug })
      .from(places)
      .where(publicPlace)
      .orderBy(asc(places.slug))
      .limit(SITEMAP_PAGE_SIZE)
      .offset(offset);
    // A place's page changes with its tables; the place row keeps no modification date.
    return { entries: rows };
  }
  const rows = await db
    .select({ slug: profiles.username })
    .from(profiles)
    .where(publicProfile)
    .orderBy(asc(profiles.username))
    .limit(SITEMAP_PAGE_SIZE)
    .offset(offset);
  // Profile badges and ratings have no single authoritative last-modified timestamp.
  return { entries: rows.map(({ slug }) => ({ slug: slug! })) };
}
