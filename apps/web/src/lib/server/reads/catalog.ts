import { requireUser } from '../auth/guard';
import type { RequestEvent } from '@sveltejs/kit';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { readViaApi } from '../api-read';
export async function read({ locals, url }: RequestEvent) {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!locals.db) return { systems: [], catalog: { platforms: [], tags: [] } };
  // Through the api Worker when `api_reads_catalog` is on for this person; here otherwise.
  const remote = profile
    ? await readViaApi<Awaited<ReturnType<typeof readCatalog>>>(
        locals,
        'api_reads_catalog',
        profile,
        '/v1/reads/catalog',
      )
    : null;
  return remote ?? (await readCatalog(locals.db, profile?.id));
}
