import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../admin-access';
import { listAdminTables } from '../admin/tables';
import { instagramAccounts } from '../db/schema';
import { configured, type InstagramEnv } from '../instagram/api';
export async function read({ locals, platform, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const [account] = await locals.db
    .select({ expiresAt: instagramAccounts.expiresAt })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  return {
    tables: await listAdminTables(locals.db, url.searchParams),
    instagramAvailable:
      configured(platform?.env as InstagramEnv) && !!account && account.expiresAt > new Date(),
  };
}
