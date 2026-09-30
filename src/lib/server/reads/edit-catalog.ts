import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { loadTableForEdit } from '../tables/write';
import { timezoneOf } from '../time';
import { listSystems } from '../systems';
import { listCatalog, type CatalogItem } from '../catalog';
import { Forbidden, NotFound } from '../errors';
export async function read({ locals, url, params, cookies }: RequestEvent) {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database unavailable');
  try {
    const profile = await locals.getProfile();
    const { catalog: picked } = await loadTableForEdit(
      locals.db,
      profile,
      params.slug!,
      await timezoneOf(locals, cookies),
    );
    const [systems, offered] = await Promise.all([
      listSystems(locals.db),
      listCatalog(locals.db, { suggestedBy: profile?.id }),
    ]);
    const merge = (items: CatalogItem[], picks: CatalogItem[]) => [
      ...items,
      ...picks.filter((p) => !items.some((i) => i.slug === p.slug)),
    ];
    return {
      systems: systems.map(({ name, slug }) => ({ name, slug })),
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
