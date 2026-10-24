import { error, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import { listAdminProfiles } from '@mesaaberta/core/server/admin/profiles';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readViaApi } from '../api-read';

export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  // Through the api Worker when `api_reads_admin_users` is on for this admin; here otherwise.
  const viewer = await locals.getProfile();
  const remote = viewer
    ? await readViaApi<Awaited<ReturnType<typeof listAdminProfiles>>>(
        locals,
        'api_reads_admin_users',
        viewer,
        `/v1/admin-reads/users${url.search}`,
      )
    : null;
  // JSON turned the sign-up date into a string; the page gets it as a date either way.
  const profiles = remote
    ? {
        ...remote,
        rows: remote.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) })),
      }
    : await listAdminProfiles(locals.db, url.searchParams);
  const supabase = supabaseUrlOf(locals.env);
  return {
    profiles: {
      ...profiles,
      // The page gets the picture to draw, not the storage paths.
      rows: profiles.rows.map(({ avatarPath, avatarUrl, ...row }) => ({
        ...row,
        avatar: pictureOf(supabase, { avatarPath, avatarUrl }),
      })),
    },
  };
}

export type AdminProfilesView = Awaited<ReturnType<typeof read>>['profiles'];
