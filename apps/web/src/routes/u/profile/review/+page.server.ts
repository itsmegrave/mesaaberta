import { error, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { routes } from '@mesaaberta/core/routes';
import type { PageServerLoad } from './$types';

// "Sua Retrospectiva": the signed-in person's own, of this year (the changelog links here).
export const load: PageServerLoad = async ({ locals, url }) => {
  await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!profile?.username) error(404, 'Not found');
  redirect(303, `${routes.profile(profile.username)}/review/${new Date().getUTCFullYear()}`);
};
