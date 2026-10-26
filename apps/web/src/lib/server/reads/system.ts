import { cardPictures } from './card-pictures';
import { error, redirect } from '@sveltejs/kit';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { readSystemPage } from '@mesaaberta/core/server/systems/directory';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';

/** The page of one system (`/s/[slug]`); a merged system moves to the one it was merged into. */
export const read = async ({ locals, params }: RequestEvent) => {
  await requireDirectory(locals, 'systems');
  if (!locals.db) error(503, 'Database not configured');
  const slug = params.slug ?? '';
  const found = await readSystemPage(locals.db, slug, new Date());
  if (!found) {
    // The request line already names the system (`resourceType`, `resourceId`).
    locals.log.info('system not found', { code: 'system_not_found' });
    error(404, 'Not found');
  }
  if ('redirectTo' in found) redirect(301, `/s/${found.redirectTo}`);

  const supabase = supabaseUrlOf(locals.env);
  return {
    ...found,
    openTables: found.openTables.map(cardPictures(supabase)),
    gms: found.gms.map(({ avatarPath, avatarUrl, ...gm }) => ({
      ...gm,
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
  };
};
