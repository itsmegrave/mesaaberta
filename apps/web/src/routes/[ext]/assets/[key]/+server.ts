import { error } from '@sveltejs/kit';
import { extensionById } from '@mesaaberta/core/server/extensions/index';
import type { RequestHandler } from './$types';

// The network fetches this without cookies, so there is no admin check: the asset is a random,
// expiring capability that names no table or player. An id nobody installed is just a 404.
export const GET: RequestHandler = async ({ locals, params }) => {
  const asset = extensionById(params.ext)?.asset;
  if (!asset || !locals.db) error(404);
  const found = await asset(locals.db, params.key);
  if (!found) error(404);
  return new Response(found.body, {
    headers: {
      'content-type': found.type,
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
};
