import type { AnyDb } from '../db/client';
import type { Actor } from '../auth/policy';
import { listCatalog, type CatalogItem } from '../catalog';
import { listSystems, systemOfTable } from '../systems';
import { loadTableForEdit } from '../tables/write';

/**
 * What a table's edit form offers: `readCatalog`'s lists plus the table's own picks, so a system or
 * tag still waiting for approval, or since retired, stays on the form. Throws `Forbidden`,
 * `TableConcluded` or `NotFound` like `loadTableForEdit`. Shared by web's in-process reader and the
 * api's `GET /v1/reads/edit-catalog/:slug`.
 */
export async function readEditCatalog(
  db: AnyDb,
  actor: Actor | null,
  slug: string,
  timezone: string,
) {
  const { catalog: picked, systemSlug } = await loadTableForEdit(db, actor, slug, timezone);
  const [systems, offered] = await Promise.all([
    listSystems(db, { suggestedBy: actor?.id }),
    listCatalog(db, { suggestedBy: actor?.id }),
  ]);
  // The table's own system is always offered: a suggestion still waiting, or one since retired.
  const held = systems.some((system) => system.slug === systemSlug)
    ? null
    : await systemOfTable(db, systemSlug);
  const merge = (items: CatalogItem[], picks: CatalogItem[]) => [
    ...items,
    ...picks.filter((p) => !items.some((i) => i.slug === p.slug)),
  ];
  return {
    systems: held
      ? [
          ...systems,
          {
            name: held.name,
            slug: systemSlug,
            ...(held.status === 'pending' ? { pending: true as const } : {}),
          },
        ]
      : systems,
    catalog: {
      platforms: merge(offered.platforms, picked.platforms),
      tags: merge(offered.tags, picked.tags),
    },
  };
}
