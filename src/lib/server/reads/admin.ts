import { error, type RequestEvent } from '@sveltejs/kit';
import { can } from '../auth/policy';
import { adminOverview } from '../admin/queries';

export async function read({ locals, setHeaders }: RequestEvent) {
  if (!can(await locals.getProfile(), 'admin:access')) error(404, 'Not found');
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  return adminOverview(locals.db);
}
