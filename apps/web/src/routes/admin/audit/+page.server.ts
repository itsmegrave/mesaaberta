import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { auditLog } from '$lib/server/moderation/admin';
import type { PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const log = await auditLog(locals.db, await locals.getProfile(), url.searchParams);
  if (!log) error(404, 'Not found');
  return { log };
};
