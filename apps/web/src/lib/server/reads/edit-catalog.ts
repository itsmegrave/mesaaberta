import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { timezoneOf } from '../time';
import type { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
import { readFromApi } from '../api-read';
export async function read({ locals, url, params, cookies }: RequestEvent) {
  const user = await requireUser(locals, url);
  const timezone = await timezoneOf(locals, cookies);
  // Read by the api Worker; its refusals become the page's 403 (with `table_concluded`) or 404.
  return readFromApi<Awaited<ReturnType<typeof readEditCatalog>>>(
    locals,
    user.id,
    `/v1/reads/edit-catalog/${encodeURIComponent(params.slug!)}?tz=${encodeURIComponent(timezone)}`,
  );
}
