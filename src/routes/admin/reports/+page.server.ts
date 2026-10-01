import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { listReports } from '$lib/server/moderation/admin';
import type { PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const reports = await listReports(locals.db, await locals.getProfile(), url.searchParams);
  if (!reports) error(404, 'Not found');
  return { reports };
};
