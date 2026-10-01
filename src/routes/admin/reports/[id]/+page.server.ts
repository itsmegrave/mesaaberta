import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { requireUser } from '$lib/server/auth/guard';
import { reportDetail } from '$lib/server/moderation/admin';
import { reportActions } from '$lib/server/moderation/admin-actions';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and each load and
// action checks again.
export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!UUID.test(params.id)) error(404, 'Not found');
  if (!locals.db) error(503, 'Database not configured');

  const report = await reportDetail(locals.db, await locals.getProfile(), params.id);
  if (!report) error(404, 'Not found');
  return { report };
};

export const actions: Actions = reportActions;
