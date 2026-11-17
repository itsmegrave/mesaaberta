// Iniciantes: a table is good for people who never played when its GM picks the catalog's
// "Iniciantes" tag (seeded in 0013). The mark on cards and the table page, the /tables filter and
// the "Primeira mesa" guide all hang on that one tag.

/** The slug of the catalog tag that marks a table as good for beginners. */
export const BEGINNER_TAG = 'iniciantes';

/** Whether a table's tags (slugs, or `{ slug }` items) carry the beginners tag. */
export function isBeginnerTable(tags: readonly (string | { slug?: string })[] | undefined) {
  return (tags ?? []).some((tag) => (typeof tag === 'string' ? tag : tag.slug) === BEGINNER_TAG);
}

/** The open tables that carry the tag. */
export const BEGINNER_TABLES_HREF = `/tables?tag=${BEGINNER_TAG}`;
