import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import type { listAdminCrowdfundings } from '@mesaaberta/core/server/crowdfunding/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';
import { imageUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { crowdfundingActions } from '#lib/server/moderation/admin-actions.js';
import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const list = revivedDates(
    await readFromApi<NonNullable<Awaited<ReturnType<typeof listAdminCrowdfundings>>>>(
      locals,
      user.id,
      `/v1/admin-reads/crowdfundings?${url.searchParams}`,
    ),
  );
  const supabase = supabaseUrlOf(locals.env);
  return {
    crowdfundings: {
      ...list,
      rows: list.rows.map(({ imagePath, ...row }) => ({
        ...row,
        cover: imageUrl(supabase, imagePath),
      })),
    },
  };
};

export const actions: Actions = { remove: crowdfundingActions.remove };
