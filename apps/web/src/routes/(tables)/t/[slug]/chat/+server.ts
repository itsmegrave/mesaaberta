import { redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { openTableChatViaApi } from '#lib/server/messages/api.js';
import type { RequestHandler } from './$types';

/**
 * Opens a table's chat for its GM and confirmed players: makes the conversation on first use, makes
 * sure they are in it, and goes to it. Anyone else gets a 404, as if there were no chat.
 */
export const GET: RequestHandler = async ({ locals, url, params }) => {
  const user = await requireUser(locals, url);
  const { conversationId } = await openTableChatViaApi(locals, user.id, params.slug);
  redirect(303, `/m/${conversationId}`);
};
