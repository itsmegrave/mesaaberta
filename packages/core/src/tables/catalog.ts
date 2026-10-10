/**
 * A platform or tag the catalog does not have yet travels in the table form as `new:<name>`: the
 * table's save turns it into the GM's suggestion (see `setTableCatalog`). Catalog slugs are
 * lowercase letters, digits and hyphens, so they never start with it.
 */
export const NEW_CATALOG_PREFIX = 'new:';

/** How long a suggested name may be. */
export const SUGGESTION_NAME = { min: 2, max: 40 } as const;

/** How a pick reads: the entry's name, or the name a suggestion was typed with. */
export function pickName(items: { name: string; slug: string }[], pick: string): string {
  if (pick.startsWith(NEW_CATALOG_PREFIX)) return pick.slice(NEW_CATALOG_PREFIX.length);
  return items.find((item) => item.slug === pick)?.name ?? pick;
}
