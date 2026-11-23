// Where a catalog entry (system, platform, tag, place feature) stands: a GM's suggestion waits on an
// admin, who lets it in, turns it down or merges it into another entry; an entry in the catalog can
// be taken out of the choice list.
export const CATALOG_STATUSES = ['pending', 'approved', 'rejected', 'disabled'] as const;
export type CatalogStatus = (typeof CATALOG_STATUSES)[number];
