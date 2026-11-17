import { error } from '@sveltejs/kit';
import { markReadViaApi } from '#lib/server/messages/api.js';
import type { RequestHandler } from './$types';

/**
 * The open thread says its reader saw the newest message: only while the page is in front, and
 * only when something new arrived, so a poll in the background never counts as reading.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  await markReadViaApi(locals, user.id, params.id);
  return new Response(null, { status: 204, headers: { 'cache-control': 'private, no-store' } });
};
