import { error } from '@sveltejs/kit';
import { stringify } from 'devalue';
import { listInbox } from '$lib/server/messages/service';
import { inboxWithPictures } from '$lib/server/messages/present';
import { supabaseUrlOf } from '$lib/server/images';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url, platform }) => {
  const user = await locals.getUser();
  if (!user) error(401, 'Sign in required');
  if (!locals.db) error(503, 'Database not configured');
  const raw = url.searchParams.get('page');
  const page = raw && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 1;
  const inbox = await listInbox(locals.db, user.id, page);
  return new Response(
    stringify({ ...inbox, items: inboxWithPictures(supabaseUrlOf(platform?.env), inbox.items) }),
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
