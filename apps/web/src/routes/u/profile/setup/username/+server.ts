import { error } from '@sveltejs/kit';
import { usernameAvailable } from '#lib/server/profile/api.js';
import { normalizeUsername, usernameProblem } from '@mesaaberta/core/profile/username';
import type { RequestHandler } from './$types';

/**
 * Whether a username is free, for the onboarding form to say so while it is typed. It answers one
 * word (`free`, `taken` or `invalid`) and never anything about who has the name. Only for people
 * signed in, who may not have finished their profile.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in first');

  const value = normalizeUsername(url.searchParams.get('value') ?? '');
  // Nothing goes to the api for a name that could not be taken anyway.
  const status =
    usernameProblem(value) !== null
      ? 'invalid'
      : (await usernameAvailable(locals, user.id, value))
        ? 'free'
        : 'taken';

  // A stale answer is worse than none: the person may be about to pick this name.
  return Response.json({ status }, { headers: { 'cache-control': 'no-store' } });
};
