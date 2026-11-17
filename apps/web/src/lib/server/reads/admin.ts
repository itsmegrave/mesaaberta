import type { RequestEvent } from '@sveltejs/kit';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { requireAdmin } from '../admin-access';
import type { adminOverview } from '@mesaaberta/core/server/admin/queries';
import { readFromApi } from '../api-read';

export async function read({ locals, setHeaders }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  const remote = await readFromApi<Awaited<ReturnType<typeof adminOverview>>>(
    locals,
    (await locals.getUser())!.id,
    '/v1/admin-reads/overview',
  );
  // JSON turned the dates into strings; the page gets them as dates.
  const overview = {
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
  };
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
