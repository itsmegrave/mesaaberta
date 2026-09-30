import { error, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import { adminOverview } from '../admin/queries';
import { listAdminProfiles } from '../admin/profiles';

export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const [overview, profiles] = await Promise.all([
    adminOverview(locals.db),
    listAdminProfiles(locals.db, url.searchParams),
  ]);
  return { ...overview, profiles };
}
