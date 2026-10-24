import type { AnyDb } from '../db/client';
import { listCatalog } from '../catalog';
import { listSystems } from '../systems';
import { listUpcomingTables } from '../tables/queries';
import type { TableFilters } from '../../tables/filters';

// Tags shown as chips before "Mais tags".
const FEATURED_TAGS = 7;

/**
 * What the `/tables` page lists for the filters ticked: the upcoming tables that match, the
 * systems ranked by how many tables they have, and the catalog with the tags in use first. `gmId`
 * stays on the server (the page only needs the GM's name) and each picture is still a storage
 * path: the caller turns it into a URL with its own Supabase settings. Shared by web's in-process
 * reader and the api's `GET /v1/reads/tables`.
 */
export async function readTables(db: AnyDb, filters: TableFilters, now: Date) {
  const {
    systems: pickedSystems,
    modality,
    platforms: pickedPlatforms,
    tags: pickedTags,
  } = filters;
  const [upcoming, systems, catalog] = await Promise.all([
    listUpcomingTables(db, now),
    listSystems(db),
    listCatalog(db),
  ]);

  // Tags in use come first; the rest wait behind "Mais tags", unless one of them is ticked.
  const tagUse = new Map<string, number>();
  for (const table of upcoming) {
    for (const tag of table.tags) tagUse.set(tag.slug, (tagUse.get(tag.slug) ?? 0) + 1);
  }
  const rankedTags = catalog.tags
    .map((tag, position) => ({ ...tag, use: tagUse.get(tag.slug) ?? 0, position }))
    .sort((a, b) => b.use - a.use || a.position - b.position)
    .map(({ name, slug }) => ({ name, slug }));
  const shownTags = rankedTags.filter(
    (tag, i) => i < FEATURED_TAGS || pickedTags.includes(tag.slug),
  );

  // In the dropdown, systems with the most upcoming tables come first, then the catalogue order.
  const counts = new Map<string, number>();
  for (const table of upcoming) {
    counts.set(table.system.slug, (counts.get(table.system.slug) ?? 0) + 1);
  }
  const ranked = systems
    .map(({ name, slug }, position) => ({ name, slug, count: counts.get(slug) ?? 0, position }))
    .sort((a, b) => b.count - a.count || a.position - b.position)
    .map(({ name, slug }) => ({ name, slug }));

  const tables = upcoming.filter(
    (table) =>
      (pickedSystems.length === 0 || pickedSystems.includes(table.system.slug)) &&
      (!modality || table.modality === modality) &&
      (pickedPlatforms.length === 0 ||
        table.platforms.some((p) => pickedPlatforms.includes(p.slug))) &&
      (pickedTags.length === 0 || table.tags.some((t) => pickedTags.includes(t.slug))),
  );

  return {
    tables: tables.map(({ gmId, ...table }) => table),
    systems: ranked,
    pickedSystems,
    modality,
    catalog: {
      platforms: catalog.platforms,
      tags: shownTags,
      moreTags: rankedTags.filter((tag) => !shownTags.includes(tag)),
    },
    pickedPlatforms,
    pickedTags,
  };
}
