import { decorationsFor } from '#lib/server/decorations.js';
import type { RequestHandler } from './$types';

/**
 * What the installed extensions draw on these people (`?u=ana,bia`), by lowercase username. Public
 * and the same for everyone, so a shared cache may keep it a minute.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
  const decorations = await decorationsFor(locals, (url.searchParams.get('u') ?? '').split(','));
  return Response.json({ decorations }, { headers: { 'cache-control': 'public, max-age=60' } });
};
