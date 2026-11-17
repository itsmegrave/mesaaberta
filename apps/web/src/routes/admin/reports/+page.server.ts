import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { listReports } from '@mesaaberta/core/server/moderation/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import type { PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const reports = await readFromApi<NonNullable<Awaited<ReturnType<typeof listReports>>>>(
    locals,
    user.id,
    `/v1/admin-reads/reports?${url.searchParams}`,
  );
  return { reports: revivedDates(reports) };
};
