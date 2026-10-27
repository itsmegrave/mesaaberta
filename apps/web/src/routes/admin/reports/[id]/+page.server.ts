import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { reportDetail } from '@mesaaberta/core/server/moderation/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { reportActions } from '#lib/server/moderation/admin-actions.js';
import type { Actions, PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and each load and
// action checks again.
export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!UUID.test(params.id)) error(404, 'Not found');

  const report = await readFromApi<NonNullable<Awaited<ReturnType<typeof reportDetail>>>>(
    locals,
    user.id,
    `/v1/admin-reads/reports/${params.id}`,
  );
  return { report: revivedDates(report) };
};

export const actions: Actions = reportActions;
