import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { catalogActions } from '$lib/server/admin/catalog-actions';
import { listApproved, listQueue, recentDecisions } from '$lib/server/admin/catalog';
import { requireUser } from '$lib/server/auth/guard';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and each load and
// action checks again with `requireAdmin`.
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  if (!locals.db) error(503, 'Database not configured');

  const [queue, decisions, approved] = await Promise.all([
    listQueue(locals.db),
    recentDecisions(locals.db),
    listApproved(locals.db),
  ]);
  return { queue, decisions, approved };
};

export const actions: Actions = {
  approve: catalogActions.approve,
  reject: catalogActions.reject,
  rename: catalogActions.rename,
  merge: catalogActions.merge,
};
