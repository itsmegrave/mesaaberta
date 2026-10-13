import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../admin-access';
import { listAdminTables } from '../admin/tables';
import { instagramAccounts } from '../db/schema';
import { imageUrl, supabaseUrlOf } from '../images';
import { socialFor, type SocialEnv } from '../social';
export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const [account] = await locals.db
    .select({ expiresAt: instagramAccounts.expiresAt })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  const tables = await listAdminTables(locals.db, url.searchParams);
  const supabase = supabaseUrlOf(locals.env);
  return {
    tables: {
      ...tables,
      // The page gets the cover to draw, not the storage path.
      rows: tables.rows.map(({ imagePath, ...row }) => ({
        ...row,
        cover: imageUrl(supabase, imagePath),
      })),
    },
    instagramAvailable:
      socialFor(locals.env as SocialEnv).configured(locals.env) &&
      !!account &&
      account.expiresAt > new Date(),
  };
}

export type AdminTablesView = Awaited<ReturnType<typeof read>>['tables'];
