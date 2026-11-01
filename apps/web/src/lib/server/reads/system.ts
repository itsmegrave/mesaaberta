import { cardPictures } from './card-pictures';
import { error, isHttpError, redirect } from '@sveltejs/kit';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import type { readSystemPage } from '@mesaaberta/core/server/systems/directory';
import { readFromApi, revivedDates } from '../api-read';
import type { RequestEvent } from '@sveltejs/kit';
import { requireDirectory } from '../directories/flags';
import { contentRatingSymbolShown } from '../tables/safety-enabled';

/** The page of one system (`/s/[slug]`); a merged system moves to the one it was merged into. */
export const read = async ({ locals, params }: RequestEvent) => {
  await requireDirectory(locals, 'systems');
  const slug = params.slug ?? '';
  const found = await readFromApi<NonNullable<Awaited<ReturnType<typeof readSystemPage>>>>(
    locals,
    (await locals.getUser())?.id ?? null,
    `/v1/reads/systems/${encodeURIComponent(slug)}`,
  )
    .then(revivedDates)
    .catch((cause) => {
      if (isHttpError(cause) && cause.status === 404) return null;
      throw cause;
    });
  if (!found) {
    // The request line already names the system (`resourceType`, `resourceId`).
    locals.log.info('systems.not_found', { code: 'system_not_found' });
    error(404, 'Not found');
  }
  if ('redirectTo' in found) redirect(301, `/s/${found.redirectTo}`);

  const supabase = supabaseUrlOf(locals.env);
  return {
    ...found,
    openTables: found.openTables.map(
      cardPictures(supabase, await contentRatingSymbolShown(locals, await locals.getProfile())),
    ),
    gms: found.gms.map(({ avatarPath, avatarUrl, ...gm }) => ({
      ...gm,
      avatarUrl: pictureOf(supabase, { avatarPath, avatarUrl }),
    })),
  };
};
