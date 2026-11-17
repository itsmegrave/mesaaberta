import { error } from '@sveltejs/kit';
import { readBadges } from '#lib/server/me.js';
import { badgesEnabled } from '#lib/server/badges/enabled.js';
import type { RequestHandler } from './$types';

/**
 * The two numbers in the header, for the page to poll: unread notifications (the bell) and the
 * conversations with something unread (the messages link). Private to the signed-in person.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');

  const profile = await locals.getProfile();
  const withAchievements = profile ? await badgesEnabled(locals, profile) : false;
  const { unread, messages } = await readBadges(locals, user.id, withAchievements);
  return Response.json({ unread, messages }, { headers: { 'cache-control': 'private, no-store' } });
};
