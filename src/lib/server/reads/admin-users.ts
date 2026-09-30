import { error, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import { listAdminProfiles } from '../admin/profiles';

export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  return { profiles: await listAdminProfiles(locals.db, url.searchParams) };
}
