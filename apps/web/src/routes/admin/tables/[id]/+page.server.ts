import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import type { adminTable } from '@mesaaberta/core/server/admin/tables';
import type { tableHistory } from '@mesaaberta/core/server/admin/history';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ locals, params, setHeaders }) => {
  const admin = await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!UUID.test(params.id)) error(404, 'Not found');
  // The table and its history; an unknown table is the api's 404, which becomes the page's.
  return revivedDates(
    await readFromApi<{
      table: NonNullable<Awaited<ReturnType<typeof adminTable>>>;
      history: Awaited<ReturnType<typeof tableHistory>>;
    }>(locals, admin.id, `/v1/admin-reads/tables/${params.id}`),
  );
};
