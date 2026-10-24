import { error } from '@sveltejs/kit';
import { isUsernameAvailable } from '@mesaaberta/core/server/profile/service';
import { normalizeUsername, usernameProblem } from '@mesaaberta/core/profile/username';
import type { RequestHandler } from './$types';

/**
 * Whether a username is free, for the onboarding form to say so while it is typed. It answers one
 * word (`free`, `taken` or `invalid`) and never anything about who has the name. Only for people
 * signed in, who may not have finished their profile.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  if (!(await locals.getUser())) error(401, 'Sign in first');
  if (!locals.db) error(503, 'Database not configured');

  const value = normalizeUsername(url.searchParams.get('value') ?? '');
  // Nothing goes to the database for a name that could not be taken anyway.
  const status =
    usernameProblem(value) !== null
      ? 'invalid'
      : (await isUsernameAvailable(locals.db, value, { exceptProfileId: locals.userId }))
        ? 'free'
        : 'taken';

  // A stale answer is worse than none: the person may be about to pick this name.
  return Response.json({ status }, { headers: { 'cache-control': 'no-store' } });
};
