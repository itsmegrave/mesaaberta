import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { supabaseUrlOf } from '$lib/server/images';
import { NotFound } from '$lib/server/errors';
import { listMessages, markConversationRead } from '$lib/server/messages/service';
import { withPictures } from '$lib/server/messages/present';
import type { RequestHandler } from './$types';

/**
 * A conversation's newest messages, for the open thread to poll, or the ones before `before` (an
 * ISO time) for "see older". Reading the latest page counts as reading the conversation.
 */
export const GET: RequestHandler = async ({ locals, params, url, platform }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  if (!locals.db) error(503, 'Database not configured');
  const actor = await locals.getProfile();

  const beforeParam = url.searchParams.get('before');
  const before = beforeParam ? new Date(beforeParam) : undefined;
  if (before && Number.isNaN(before.getTime())) error(400, 'Bad time');

  try {
    const thread = await listMessages(locals.db, actor, params.id, { before });
    if (!before) await markConversationRead(locals.db, actor, params.id);
    const supabaseUrl = supabaseUrlOf(platform?.env);
    return new Response(
      stringify({ ...thread, messages: withPictures(supabaseUrl, thread.messages) }),
      {
        headers: {
          'content-type': 'application/json',
          'x-query-codec': 'devalue',
          'cache-control': 'private, no-store',
          'x-query-viewer': user.id,
        },
      },
    );
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};
