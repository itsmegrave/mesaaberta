import { and, asc, eq, inArray } from 'drizzle-orm';
import type { AnyDb } from './db/client';
import { gameTablePlatforms, gameTableTags, platforms, tags } from './db/schema';
import { Invalid } from './errors';

/** One entry of the catalog, as pickers and chips show it. */
export type CatalogItem = { name: string; slug: string };

/** The approved platforms and tags, in catalog order: what the form offers and the list filters by. */
export async function listCatalog(
  db: AnyDb,
): Promise<{ platforms: CatalogItem[]; tags: CatalogItem[] }> {
  const [p, t] = await Promise.all([
    db
      .select({ name: platforms.name, slug: platforms.slug })
      .from(platforms)
      .where(eq(platforms.status, 'approved'))
      .orderBy(asc(platforms.position), asc(platforms.name)),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(tags)
      .where(eq(tags.status, 'approved'))
      .orderBy(asc(tags.position), asc(tags.name)),
  ]);
  return { platforms: p, tags: t };
}

/**
 * Replaces a table's platforms and tags with the ones picked, in the order picked. Only approved
 * entries can be picked: an unknown or unapproved slug throws `Invalid` on its field.
 */
export async function setTableCatalog(
  db: AnyDb,
  tableId: string,
  { platformSlugs, tagSlugs }: { platformSlugs: string[]; tagSlugs: string[] },
) {
  const resolve = async (
    table: typeof platforms | typeof tags,
    slugs: string[],
    field: 'platforms' | 'tags',
  ) => {
    if (slugs.length === 0) return [];
    const rows = await db
      .select({ id: table.id, slug: table.slug })
      .from(table)
      .where(and(inArray(table.slug, slugs), eq(table.status, 'approved')));
    const bySlug = new Map(rows.map((row) => [row.slug, row.id]));
    if (slugs.some((slug) => !bySlug.has(slug))) throw new Invalid(field, 'invalid');
    return slugs.map((slug) => bySlug.get(slug)!);
  };

  const platformIds = await resolve(platforms, [...new Set(platformSlugs)], 'platforms');
  const tagIds = await resolve(tags, [...new Set(tagSlugs)], 'tags');

  await db.delete(gameTablePlatforms).where(eq(gameTablePlatforms.tableId, tableId));
  await db.delete(gameTableTags).where(eq(gameTableTags.tableId, tableId));
  if (platformIds.length > 0) {
    await db
      .insert(gameTablePlatforms)
      .values(platformIds.map((platformId, position) => ({ tableId, platformId, position })));
  }
  if (tagIds.length > 0) {
    await db
      .insert(gameTableTags)
      .values(tagIds.map((tagId, position) => ({ tableId, tagId, position })));
  }
}

/** The approved platforms and tags of each table, in the GM's order, keyed by table id. */
export async function catalogOf(
  db: AnyDb,
  tableIds: string[],
): Promise<Map<string, { platforms: CatalogItem[]; tags: CatalogItem[] }>> {
  const result = new Map(
    tableIds.map((id) => [id, { platforms: [] as CatalogItem[], tags: [] as CatalogItem[] }]),
  );
  if (tableIds.length === 0) return result;

  const [p, t] = await Promise.all([
    db
      .select({ tableId: gameTablePlatforms.tableId, name: platforms.name, slug: platforms.slug })
      .from(gameTablePlatforms)
      .innerJoin(platforms, eq(gameTablePlatforms.platformId, platforms.id))
      .where(and(inArray(gameTablePlatforms.tableId, tableIds), eq(platforms.status, 'approved')))
      .orderBy(asc(gameTablePlatforms.position)),
    db
      .select({ tableId: gameTableTags.tableId, name: tags.name, slug: tags.slug })
      .from(gameTableTags)
      .innerJoin(tags, eq(gameTableTags.tagId, tags.id))
      .where(and(inArray(gameTableTags.tableId, tableIds), eq(tags.status, 'approved')))
      .orderBy(asc(gameTableTags.position)),
  ]);
  for (const { tableId, name, slug } of p) result.get(tableId)!.platforms.push({ name, slug });
  for (const { tableId, name, slug } of t) result.get(tableId)!.tags.push({ name, slug });
  return result;
}
