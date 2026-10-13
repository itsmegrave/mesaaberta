import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/auth/guard';
import { NotFound } from '@mesaaberta/core/server/errors';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { inboxWithPictures } from '@mesaaberta/core/server/messages/present';
import { listInbox } from '@mesaaberta/core/server/messages/service';
import type { LayoutServerLoad } from './$types';

/** `?page=N`: anything that is not a positive whole number reads as the first page. */
const pageOf = (url: URL) => {
  const raw = url.searchParams.get('page');
  return raw !== null && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 1;
};

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  // The page refreshes the list now and then by invalidating this.
  depends('messages:inbox');

  try {
    const inbox = await listInbox(locals.db, user.id, pageOf(url));
    return {
      inbox: { ...inbox, items: inboxWithPictures(supabaseUrlOf(locals.env), inbox.items) },
    };
  } catch (cause) {
    if (cause instanceof NotFound) error(404, 'Not found');
    throw cause;
  }
};
