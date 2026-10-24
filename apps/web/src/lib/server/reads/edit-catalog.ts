import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '../auth/guard';
import { timezoneOf } from '../time';
import { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
import { Forbidden, NotFound, TableConcluded } from '@mesaaberta/core/server/errors';
import { readViaApi } from '../api-read';
export async function read({ locals, url, params, cookies }: RequestEvent) {
  await requireUser(locals, url);
  if (!locals.db) error(503, 'Database unavailable');
  try {
    const profile = await locals.getProfile();
    const timezone = await timezoneOf(locals, cookies);
    // Through the api Worker when `api_reads_edit_catalog` is on for this person. A refusal there
    // is not used: the in-process reader below raises the same error the page shows.
    const remote = profile
      ? await readViaApi<Awaited<ReturnType<typeof readEditCatalog>>>(
          locals,
          'api_reads_edit_catalog',
          profile,
          `/v1/reads/edit-catalog/${encodeURIComponent(params.slug!)}?tz=${encodeURIComponent(timezone)}`,
        )
      : null;
    return remote ?? (await readEditCatalog(locals.db, profile, params.slug!, timezone));
  } catch (cause) {
    if (cause instanceof TableConcluded)
      error(403, { message: 'Forbidden', code: 'table_concluded' });
    if (cause instanceof Forbidden) error(403, 'Forbidden');
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
}
