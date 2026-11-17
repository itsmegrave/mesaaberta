import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { partnerLogoUrl, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { partnerActions } from '#lib/server/moderation/admin-actions.js';
import type { listAdminPartners } from '@mesaaberta/core/server/partners/admin';
import { readFromApi, revivedDates } from '#lib/server/api-read.js';

import type { Actions, PageServerLoad } from './$types';

// Only admins get this far: `handleAdminAccess` answers 404 to anyone else, and the load checks again.
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  const user = await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });

  // A page past the last is the api's 404, which becomes the page's.
  const list = revivedDates(
    await readFromApi<NonNullable<Awaited<ReturnType<typeof listAdminPartners>>>>(
      locals,
      user.id,
      `/v1/admin-reads/partners?${url.searchParams}`,
    ),
  );
  const supabase = supabaseUrlOf(locals.env);
  return {
    partners: {
      ...list,
      rows: list.rows.map(({ logoPath, ...row }) => ({
        ...row,
        logo: partnerLogoUrl(supabase, logoPath),
      })),
    },
  };
};

export const actions: Actions = {
  approve: partnerActions.approve,
  remove: partnerActions.remove,
  setTypes: partnerActions.setTypes,
};
