import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { loadChatThread } from '$lib/server/messages/thread';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!(await event.locals.getUser())) error(401, 'Sign in required');
  const data = await loadChatThread(event, event.params.id);
  return new Response(stringify(data), {
    headers: {
      'content-type': 'application/json',
      'x-query-codec': 'devalue',
      'cache-control': 'private, no-store',
      'x-query-viewer': data.viewerId,
    },
  });
};
