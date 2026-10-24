import { error, type RequestEvent } from '@sveltejs/kit';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { requireAdmin } from '../admin-access';
import { adminOverview } from '@mesaaberta/core/server/admin/queries';
import { readViaApi } from '../api-read';

export async function read({ locals, setHeaders }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  // Through the api Worker when `api_reads_admin` is on for this admin; here otherwise.
  const profile = await locals.getProfile();
  const remote = profile
    ? await readViaApi<Awaited<ReturnType<typeof adminOverview>>>(
        locals,
        'api_reads_admin',
        profile,
        '/v1/admin-reads/overview',
      )
    : null;
  // JSON turned the dates into strings; the page gets them as dates either way.
  const overview = remote
    ? {
        ...remote,
        attention: {
          ...remote.attention,
          reports: {
            ...remote.attention.reports,
            oldestAt: remote.attention.reports.oldestAt
              ? new Date(remote.attention.reports.oldestAt)
              : null,
          },
          awaiting: {
            ...remote.attention.awaiting,
            first: remote.attention.awaiting.first && {
              ...remote.attention.awaiting.first,
              startsAt: new Date(remote.attention.awaiting.first.startsAt),
            },
          },
        },
        recent: remote.recent.map((row) => ({ ...row, startsAt: new Date(row.startsAt) })),
        updatedAt: new Date(remote.updatedAt),
      }
    : await adminOverview(locals.db);
  const supabase = supabaseUrlOf(locals.env);
  return {
    ...overview,
    // The page gets the cover to draw, not the storage path.
    recent: overview.recent.map(({ imagePath, ...row }) => ({
      ...row,
      cover: imageUrl(supabase, imagePath),
    })),
  };
}
