import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import type { LayoutServerLoad } from './$types';

// Every part of "Editar perfil" is the signed-in person's own; the header needs their @usuário.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  return { username: (await loadProfileForm(locals.db, user.id))?.username ?? '' };
};
