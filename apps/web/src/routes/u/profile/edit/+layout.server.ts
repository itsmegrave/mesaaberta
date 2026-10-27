import { requireUser } from '#lib/server/auth/guard.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { signedInHomeEnabled } from '#lib/server/profile/signed-in-home.js';
import type { LayoutServerLoad } from './$types';

// Every part of "Editar perfil" is the signed-in person's own; the header needs their @usuário, and
// the side menu whether "Sistemas favoritos" and "Seguindo" are on for them.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  const [systems, following] = await Promise.all([
    profile ? signedInHomeEnabled(locals, profile) : false,
    profile ? followsEnabled(locals, profile) : false,
  ]);
  return {
    username: profile?.username ?? '',
    systemsSection: systems,
    followingSection: following,
  };
};
