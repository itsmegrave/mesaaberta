import { requireUser } from '#lib/server/auth/guard.js';
import { supabaseUrlOf } from '@mesaaberta/core/server/images';
import { inboxWithPictures } from '@mesaaberta/core/server/messages/present';
import { readInbox } from '#lib/server/messages/api.js';
import type { LayoutServerLoad } from './$types';

/** `?page=N`: anything that is not a positive whole number reads as the first page. */
const pageOf = (url: URL) => {
  const raw = url.searchParams.get('page');
  return raw !== null && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : 1;
};

export const load: LayoutServerLoad = async ({ locals, url, depends }) => {
  const user = await requireUser(locals, url);
  // The page refreshes the list now and then by invalidating this.
  depends('messages:inbox');

  // A page past the last is the api's 404, which becomes the page's.
  const inbox = await readInbox(locals, user.id, pageOf(url));
  return {
    inbox: { ...inbox, items: inboxWithPictures(supabaseUrlOf(locals.env), inbox.items) },
  };
};
