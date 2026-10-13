import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { loadTableForEdit } from '@mesaaberta/core/server/tables/write';
import { timezoneOf } from '../time';
import { listSystems, systemOfTable } from '@mesaaberta/core/server/systems';
import { listCatalog, type CatalogItem } from '@mesaaberta/core/server/catalog';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
export async function read({ locals, url, params, cookies }: RequestEvent) {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database unavailable');
  try {
    const profile = await locals.getProfile();
    const { catalog: picked, systemSlug } = await loadTableForEdit(
      locals.db,
      profile,
      params.slug!,
      await timezoneOf(locals, cookies),
    );
    const [systems, offered] = await Promise.all([
      listSystems(locals.db, { suggestedBy: profile?.id }),
      listCatalog(locals.db, { suggestedBy: profile?.id }),
    ]);
    // The table's own system is always offered: a suggestion still waiting, or one since retired.
    const held = systems.some((system) => system.slug === systemSlug)
      ? null
      : await systemOfTable(locals.db, systemSlug);
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
  } catch (cause) {
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
}
