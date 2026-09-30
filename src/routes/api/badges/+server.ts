import { error, json } from '@sveltejs/kit';
import { unreadConversations } from '$lib/server/messages/service';
import { unreadCount } from '$lib/server/notifications/service';
import type { RequestHandler } from './$types';

/**
 * The two numbers in the header, for the page to poll: unread notifications (the bell) and the
 * conversations with something unread (the messages link). Private to the signed-in person.
 */
export const GET: RequestHandler = async ({ locals }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  if (!locals.db) error(503, 'Database not configured');

  const [unread, messages] = await Promise.all([
    unreadCount(locals.db, user.id),
    unreadConversations(locals.db, user.id),
  ]);
  return json({ unread, messages }, { headers: { 'cache-control': 'private, no-store' } });
};
