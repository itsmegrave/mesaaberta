import { requireAdmin } from '#lib/server/admin-access.js';
import { catalogActions } from '#lib/server/admin/catalog-actions.js';
import type {
  listApproved,
  listQueue,
  recentDecisions,
} from '@mesaaberta/core/server/admin/catalog';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and each load and
// action checks again with `requireAdmin`.
export const load: PageServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);

  return revivedDates(
    await readFromApi<{
      queue: Awaited<ReturnType<typeof listQueue>>;
      decisions: Awaited<ReturnType<typeof recentDecisions>>;
      approved: Awaited<ReturnType<typeof listApproved>>;
    }>(locals, user.id, '/v1/admin-reads/queue'),
  );
};

export const actions: Actions = {
  approve: catalogActions.approve,
  reject: catalogActions.reject,
  rename: catalogActions.rename,
  merge: catalogActions.merge,
};
