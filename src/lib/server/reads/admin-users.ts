import { error, type RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import { listAdminProfiles } from '../admin/profiles';
import { pictureOf, supabaseUrlOf } from '../images';

export async function read({ locals, platform, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');
  const profiles = await listAdminProfiles(locals.db, url.searchParams);
  const supabase = supabaseUrlOf(platform?.env);
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
