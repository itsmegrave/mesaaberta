import type { RequestEvent } from '@sveltejs/kit';
import { requireAdmin } from '../admin-access';
import type { listAdminProfiles } from '@mesaaberta/core/server/admin/profiles';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readFromApi } from '../api-read';

export async function read({ locals, setHeaders, url }: RequestEvent) {
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  const remote = await readFromApi<Awaited<ReturnType<typeof listAdminProfiles>>>(
    locals,
    (await locals.getUser())!.id,
    `/v1/admin-reads/users${url.search}`,
  );
  // JSON turned the sign-up date into a string; the page gets it as a date.
  const profiles = {
    ...remote,
    rows: remote.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt) })),
  };
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
