import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../admin-access';
import { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { instagramAccounts } from '@mesaaberta/core/server/db/schema';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readViaApi } from '../api-read';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import { noSocial } from '@mesaaberta/core/server/social/none';
export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const [account] = await locals.db
    .select({ expiresAt: instagramAccounts.expiresAt })
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, 'mesaaberta'));
  // Through the api Worker when `api_reads_admin_tables` is on for this admin; here otherwise.
  const viewer = await locals.getProfile();
  const remote = viewer
    ? await readViaApi<Awaited<ReturnType<typeof listAdminTables>>>(
        locals,
        'api_reads_admin_tables',
        viewer,
        `/v1/admin-reads/tables${url.search}`,
      )
    : null;
  // JSON turned the session date into a string; the page gets it as a date either way.
  const tables = remote
    ? { ...remote, rows: remote.rows.map((row) => ({ ...row, startsAt: new Date(row.startsAt) })) }
    : await listAdminTables(locals.db, url.searchParams);
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
    // Whether a social connector is installed: without one the page has no post column or filter.
    socialInstalled: socialFor(locals.env as SocialEnv) !== noSocial,
    instagramAvailable:
      socialFor(locals.env as SocialEnv).configured(locals.env) &&
      !!account &&
      account.expiresAt > new Date(),
  };
}

export type AdminTablesView = Awaited<ReturnType<typeof read>>['tables'];
