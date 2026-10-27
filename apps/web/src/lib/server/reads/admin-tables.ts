import type { RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import type { listAdminTables } from '@mesaaberta/core/server/admin/tables';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readFromApi } from '../api-read';
import { socialFor, type SocialEnv } from '@mesaaberta/core/server/social/index';
import { noSocial } from '@mesaaberta/core/server/social/none';
export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  // With when the site's Instagram token runs out, for the post column.
  const { instagramExpiresAt, ...remote } = await readFromApi<
    Awaited<ReturnType<typeof listAdminTables>> & { instagramExpiresAt: string | null }
  >(locals, (await locals.getUser())!.id, `/v1/admin-reads/tables${url.search}`);
  // JSON turned the session date into a string; the page gets it as a date.
  const tables = {
    ...remote,
    rows: remote.rows.map((row) => ({ ...row, startsAt: new Date(row.startsAt) })),
  };
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
      instagramExpiresAt !== null &&
      new Date(instagramExpiresAt) > new Date(),
  };
}

export type AdminTablesView = Awaited<ReturnType<typeof read>>['tables'];
