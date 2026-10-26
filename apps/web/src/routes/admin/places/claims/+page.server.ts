import { error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin-access.js';
import { requireUser } from '#lib/server/auth/guard.js';
import { placeClaimActions } from '#lib/server/moderation/admin-actions.js';
import { listClaims } from '@mesaaberta/core/server/places/claims';

import type { Actions, PageServerLoad } from './$types';

// "Reivindicações": who asked to manage a place. Only admins get this far (`handleAdminAccess`
// answers 404 to anyone else, and the load checks again).
export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  await requireUser(locals, url);
  await requireAdmin(locals);
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!locals.db) error(503, 'Database not configured');

  const claims = await listClaims(locals.db, await locals.getProfile(), url.searchParams);
  if (!claims) error(404, 'Not found');
  return { claims };
};

export const actions: Actions = {
  approve: placeClaimActions.approve,
  reject: placeClaimActions.reject,
};
