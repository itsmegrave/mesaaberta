import { and, asc, eq, inArray, or } from 'drizzle-orm';
import { slugify } from '$lib/slug';
import { NEW_CATALOG_PREFIX, SUGGESTION_NAME } from '$lib/tables/catalog';
import type { AnyDb } from './db/client';
import { gameTablePlatforms, gameTableTags, platforms, tags } from './db/schema';
import { Invalid } from './errors';

/**
 * One entry of the catalog, as pickers and chips show it. `pending` marks a GM's suggestion that no
 * admin has approved yet: only that GM sees it.
 */
export type CatalogItem = { name: string; slug: string; pending?: true };

type CatalogTable = typeof platforms | typeof tags;

const asItem = ({ name, slug, status }: { name: string; slug: string; status: string }) =>
  status === 'pending' ? { name, slug, pending: true as const } : { name, slug };

/**
 * The approved platforms and tags, in catalog order: what the form offers and the list filters by.
 * With `suggestedBy`, that GM's own pending suggestions come too (the form offers them to them).
 */
export async function listCatalog(
  db: AnyDb,
  { suggestedBy }: { suggestedBy?: string } = {},
): Promise<{ platforms: CatalogItem[]; tags: CatalogItem[] }> {
  const list = async (table: CatalogTable) => {
    const rows = await db
      .select({ name: table.name, slug: table.slug, status: table.status })
      .from(table)
      .where(
        suggestedBy
          ? or(
              eq(table.status, 'approved'),
              and(eq(table.status, 'pending'), eq(table.suggestedBy, suggestedBy)),
            )
          : eq(table.status, 'approved'),
      )
      .orderBy(asc(table.position), asc(table.name));
    return rows.map(asItem);
  };
  const [p, t] = await Promise.all([list(platforms), list(tags)]);
  return { platforms: p, tags: t };
}

/**
 * The entry a GM's new term stands for: the catalog's own when it has the term (approved, or
 * pending from whoever suggested it first), or a new pending suggestion by the GM. A term the
 * moderation turned down or took out cannot come back this way.
 */
async function suggestionId(
  db: AnyDb,
  table: CatalogTable,
  field: 'platforms' | 'tags',
  typed: string,
  gmId: string,
): Promise<string> {
  const name = typed.trim().replace(/\s+/g, ' ');
  const slug = slugify(name, { fallback: '' });
  if (name.length < SUGGESTION_NAME.min || name.length > SUGGESTION_NAME.max || !slug) {
    throw new Invalid(field, 'suggestion_invalid');
  }

  const [existing] = await db
    .select({ id: table.id, status: table.status })
    .from(table)
    .where(eq(table.slug, slug));
  if (existing) {
    if (existing.status === 'approved' || existing.status === 'pending') return existing.id;
    throw new Invalid(field, 'suggestion_unavailable');
  }

  const [created] = await db
    .insert(table)
    .values({ name, slug, status: 'pending', suggestedBy: gmId })
    .returning({ id: table.id });
  return created.id;
}

/**
 * Replaces a table's platforms and tags with the ones picked, in the order picked. A pick is an
 * approved entry's slug, a pending one the GM suggested or the table already has, or a new term
 * (`new:<name>`, see `NEW_CATALOG_PREFIX`), saved as the GM's suggestion. Anything else throws
 * `Invalid` on its field.
 */
export async function setTableCatalog(
  db: AnyDb,
  tableId: string,
  { gmId, platformSlugs, tagSlugs }: { gmId: string; platformSlugs: string[]; tagSlugs: string[] },
) {
  const resolve = async (
    table: CatalogTable,
    link: typeof gameTablePlatforms | typeof gameTableTags,
    picks: string[],
    field: 'platforms' | 'tags',
  ) => {
    const slugs = picks.filter((pick) => !pick.startsWith(NEW_CATALOG_PREFIX));
    const bySlug = new Map<string, string>();
    if (slugs.length > 0) {
      const linkedToTable = db
        .select({ id: 'platformId' in link ? link.platformId : link.tagId })
        .from(link)
        .where(eq(link.tableId, tableId));
      const rows = await db
        .select({ id: table.id, slug: table.slug })
        .from(table)
        .where(
          and(
            inArray(table.slug, slugs),
            or(
              eq(table.status, 'approved'),
              and(
                eq(table.status, 'pending'),
                or(eq(table.suggestedBy, gmId), inArray(table.id, linkedToTable)),
              ),
            ),
          ),
        );
      for (const row of rows) bySlug.set(row.slug, row.id);
      if (slugs.some((slug) => !bySlug.has(slug))) throw new Invalid(field, 'invalid');
    }

    const ids: string[] = [];
    for (const pick of picks) {
      ids.push(
        pick.startsWith(NEW_CATALOG_PREFIX)
          ? await suggestionId(db, table, field, pick.slice(NEW_CATALOG_PREFIX.length), gmId)
          : bySlug.get(pick)!,
      );
    }
    // A new term may turn out to be one already picked.
    return [...new Set(ids)];
  };

  const platformIds = await resolve(
    platforms,
    gameTablePlatforms,
    [...new Set(platformSlugs)],
    'platforms',
  );
  const tagIds = await resolve(tags, gameTableTags, [...new Set(tagSlugs)], 'tags');

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

/**
 * The approved platforms and tags of each table, in the GM's order, keyed by table id. With
 * `withPending` (the GM's own form), the table's pending suggestions come too, marked.
 */
export async function catalogOf(
  db: AnyDb,
  tableIds: string[],
  { withPending = false }: { withPending?: boolean } = {},
): Promise<Map<string, { platforms: CatalogItem[]; tags: CatalogItem[] }>> {
  const result = new Map(
    tableIds.map((id) => [id, { platforms: [] as CatalogItem[], tags: [] as CatalogItem[] }]),
  );
  if (tableIds.length === 0) return result;
  const shownStatuses: ('approved' | 'pending')[] = withPending
    ? ['approved', 'pending']
    : ['approved'];

  const [p, t] = await Promise.all([
    db
      .select({
        tableId: gameTablePlatforms.tableId,
        name: platforms.name,
        slug: platforms.slug,
        status: platforms.status,
      })
      .from(gameTablePlatforms)
      .innerJoin(platforms, eq(gameTablePlatforms.platformId, platforms.id))
      .where(
        and(
          inArray(gameTablePlatforms.tableId, tableIds),
          inArray(platforms.status, shownStatuses),
        ),
      )
      .orderBy(asc(gameTablePlatforms.position)),
    db
      .select({
        tableId: gameTableTags.tableId,
        name: tags.name,
        slug: tags.slug,
        status: tags.status,
      })
      .from(gameTableTags)
      .innerJoin(tags, eq(gameTableTags.tagId, tags.id))
      .where(and(inArray(gameTableTags.tableId, tableIds), inArray(tags.status, shownStatuses)))
      .orderBy(asc(gameTableTags.position)),
  ]);
  for (const { tableId, ...item } of p) result.get(tableId)!.platforms.push(asItem(item));
  for (const { tableId, ...item } of t) result.get(tableId)!.tags.push(asItem(item));
  return result;
}
