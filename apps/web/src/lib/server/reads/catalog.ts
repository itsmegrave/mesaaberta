import { requireUser } from '../auth/guard';
import type { RequestEvent } from '@sveltejs/kit';
import type { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { readFromApi } from '../api-read';
export async function read({ locals, url }: RequestEvent) {
  const user = await requireUser(locals, url);
  return readFromApi<Awaited<ReturnType<typeof readCatalog>>>(locals, user.id, '/v1/reads/catalog');
}
