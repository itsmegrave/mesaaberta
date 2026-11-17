import { requireUser } from '#lib/server/auth/guard.js';
import { availabilityEnabled } from '#lib/server/profile/availability.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { signedInHomeEnabled } from '#lib/server/profile/signed-in-home.js';
import type { LayoutServerLoad } from './$types';

// Every part of "Editar perfil" is the signed-in person's own; the header needs their @usuário, and
// the side menu whether "Sistemas favoritos", "Quando posso jogar" and "Seguindo" are on for them.
export const load: LayoutServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  const [systems, following, availability] = await Promise.all([
    profile ? signedInHomeEnabled(locals, profile) : false,
    profile ? followsEnabled(locals, profile) : false,
    profile ? availabilityEnabled(locals, profile.id) : false,
  ]);
  return {
    username: profile?.username ?? '',
    systemsSection: systems,
    followingSection: following,
    availabilitySection: availability,
  };
};
