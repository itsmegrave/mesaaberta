import { error } from '@sveltejs/kit';
import { NotFound } from '@mesaaberta/core/server/errors';
import { markConversationRead } from '@mesaaberta/core/server/messages/service';
import type { RequestHandler } from './$types';

/**
 * The open thread says its reader saw the newest message: only while the page is in front, and
 * only when something new arrived, so a poll in the background never counts as reading.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
  if (!(await locals.getUser())) error(401, 'Sign in required');
  if (!locals.db) error(503, 'Database not configured');
  try {
    await markConversationRead(locals.db, await locals.getProfile(), params.id);
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'private, no-store' } });
};
