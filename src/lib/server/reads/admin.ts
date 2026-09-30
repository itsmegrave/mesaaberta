import { error, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import { adminOverview } from '../admin/queries';

export async function read({ locals, setHeaders }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  return adminOverview(locals.db);
}
