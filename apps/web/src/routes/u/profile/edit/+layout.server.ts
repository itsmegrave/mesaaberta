import { error } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { signedInHomeEnabled } from '#lib/server/profile/signed-in-home.js';
import { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import type { LayoutServerLoad } from './$types';

// Every part of "Editar perfil" is the signed-in person's own; the header needs their @usuário, and
// the side menu whether "Sistemas favoritos" is on for them.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const profile = await locals.getProfile();
  const [form, systems] = await Promise.all([
    loadProfileForm(locals.db, user.id),
    profile ? signedInHomeEnabled(locals, profile) : false,
  ]);
  return { username: form?.username ?? '', systemsSection: systems };
};
