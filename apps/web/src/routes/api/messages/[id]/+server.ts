import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { withPictures } from '@mesaaberta/core/server/messages/present';
import { readMessages } from '#lib/server/messages/api.js';
import type { RequestHandler } from './$types';

/**
 * A conversation's newest messages, for the open thread to poll, or the ones before `before` (an
 * ISO time) for "see older". Reading never writes: the thread says what was seen with `POST read`.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');

  const beforeParam = url.searchParams.get('before');
  const before = beforeParam ? new Date(beforeParam) : undefined;
  if (before && Number.isNaN(before.getTime())) error(400, 'Bad time');

  const thread = await readMessages(locals, user.id, params.id, before);
  const supabaseUrl = supabaseUrlOf(locals.env);
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
};
