import { requireUser } from '../auth/guard';
import type { RequestEvent } from '@sveltejs/kit';
import { listSystems } from '../systems';
import { listCatalog } from '../catalog';
export async function read({ locals, url }: RequestEvent) {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!locals.db) return { systems: [], catalog: { platforms: [], tags: [] } };
  const [systems, catalog] = await Promise.all([
    listSystems(locals.db),
    listCatalog(locals.db, { suggestedBy: profile?.id }),
  ]);
  return { systems: systems.map(({ name, slug }) => ({ name, slug })), catalog };
}
