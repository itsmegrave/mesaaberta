import { cardPictures } from './card-pictures';
import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import { readHome, type Home } from '@mesaaberta/core/server/reads/home';

type HomeTable = NonNullable<Home['rows']['followed']>[number];

/**
 * The signed-in Início (see the shared reader): what waits on me, my next sessions, Sua conta,
 * news from people I follow and the three table rows, with pictures as URLs. `now` is rounded to
 * the minute so Hyperdrive serves a reload within it from its cache.
 */
export const read = async ({ locals, url }: RequestEvent) => {
  const user = await requireUser(locals, url);
  if (!locals.db) error(503, 'Database not configured');
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');

  const now = publicReadNow();
  const home = await readHome(locals.db, user.id, now, {
    follows: await followsEnabled(locals, profile),
  });
  if (!home) error(404, 'Not found');

  const supabaseUrl = supabaseUrlOf(locals.env);
  const withImage = (table: HomeTable) => cardPictures(supabaseUrl)(table);
  return {
    ...home,
    signedInHome: true as const,
    name: profile.name ?? profile.username ?? '',
    username: profile.username,
    rows: {
      followed: home.rows.followed?.map(withImage) ?? null,
      systems: home.rows.systems.map(withImage),
      fresh: home.rows.fresh.map(withImage),
    },
    account: {
      ...home.account,
      newestReview: home.account.newestReview
        ? {
            ...home.account.newestReview,
            avatarUrl: pictureOf(supabaseUrl, home.account.newestReview),
          }
        : null,
    },
    suggestions: home.suggestions.map(({ avatarPath, avatarUrl, ...person }) => ({
      ...person,
      avatarUrl: pictureOf(supabaseUrl, { avatarPath, avatarUrl }),
    })),
    now,
  };
};
