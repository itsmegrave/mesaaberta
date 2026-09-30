import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { NotFound } from '$lib/server/errors';
import { supabaseUrlOf } from '$lib/server/images';
import { inboxWithPictures } from '$lib/server/messages/present';
import { listInbox } from '$lib/server/messages/service';
import type { LayoutServerLoad } from './$types';

/** `?page=N`: anything that is not a positive whole number reads as the first page. */
const pageOf = (url: URL) => {
  const raw = url.searchParams.get('page');
  return raw !== null && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 1;
};

export const load: LayoutServerLoad = async ({ locals, url, platform, depends }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  // The page refreshes the list now and then by invalidating this.
  depends('messages:inbox');

  try {
    const inbox = await listInbox(locals.db, user.id, pageOf(url));
    return {
      inbox: { ...inbox, items: inboxWithPictures(supabaseUrlOf(platform?.env), inbox.items) },
    };
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};
