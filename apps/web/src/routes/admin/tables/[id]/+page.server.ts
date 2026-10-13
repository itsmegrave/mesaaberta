import { error } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin-access';
import { adminTable } from '$lib/server/admin/tables';
import { tableHistory } from '$lib/server/admin/history';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!UUID.test(params.id)) error(404, 'Not found');
  if (!locals.db) error(503, 'Database not configured');
  const table = await adminTable(locals.db, params.id);
  if (!table) error(404, 'Not found');
  return {
    table,
    history: await tableHistory(locals.db, await locals.getProfile(), params.id),
  };
};
