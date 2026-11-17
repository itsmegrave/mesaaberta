import { cardPictures } from './card-pictures';
import { error } from '@sveltejs/kit';
import { readFromApi, revivedDates } from '../api-read';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import { directoryEnabled, playGraphEnabled } from '#lib/server/directories/flags.js';
import { can } from '@mesaaberta/core/server/auth/policy';
import type { HomeMatches } from '@mesaaberta/core/server/matches/service';
import { contentRatingSymbolShown } from '#lib/server/tables/safety-enabled.js';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { publicReadNow } from '@mesaaberta/core/server/reads/now';
import type { readHome, Home } from '@mesaaberta/core/server/reads/home';

type HomeTable = NonNullable<Home['rows']['followed']>[number];

/**
 * The signed-in Início (see the shared reader): what waits on me, my next sessions, Sua conta,
 * news from people I follow and the three table rows, with pictures as URLs. `now` is rounded to
 * the minute so Hyperdrive serves a reload within it from its cache.
 */
export const read = async ({ locals, url }: RequestEvent) => {
  const user = await requireUser(locals, url);
  const profile = await locals.getProfile();
  if (!profile) error(404, 'Not found');

  const now = publicReadNow();
  // The api reads it (its 404 becomes the page's); `now` there is the same rounded minute.
  const [follows, matches] = await Promise.all([
    followsEnabled(locals, profile).then((on) => (on ? '?follows=1' : '')),
    matchesQuery(locals, profile),
  ]);
  const [home, combinar] = await Promise.all([
    readFromApi<NonNullable<Awaited<ReturnType<typeof readHome>>>>(
      locals,
      user.id,
      `/v1/reads/home${follows}`,
    ).then(revivedDates),
    // Combinar's section is extra: when its read fails, Início loads without it.
    matches === null
      ? null
      : readFromApi<{ section: HomeMatches | null }>(locals, user.id, `/v1/matches/home${matches}`)
          .then((read) => read.section)
          .catch((cause) => {
            locals.log.warn('home.matches_read_failed', { error: cause });
            return null;
          }),
  ]);

  const supabaseUrl = supabaseUrlOf(locals.env);
  const rating = await contentRatingSymbolShown(locals, profile);
  const withImage = (table: HomeTable) => cardPictures(supabaseUrl, rating)(table);
  return {
    ...home,
    signedInHome: true as const,
    combinar,
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

/**
 * The query for Combinar's section, or null without it: it needs `use_matchmaking` and
 * `use_home_matches`, and passes `use_play_graph` on so the count matches the deck.
 */
async function matchesQuery(
  locals: RequestEvent['locals'],
  profile: NonNullable<Awaited<ReturnType<App.Locals['getProfile']>>>,
): Promise<string | null> {
  const [directory, section, graph] = await Promise.all([
    directoryEnabled(locals, 'matches'),
    locals.flags.isEnabled('use_home_matches', {
      id: profile.id,
      isAdmin: can(profile, 'admin:access'),
    }),
    playGraphEnabled(locals),
  ]);
  if (!directory || !section) return null;
  return graph ? '?graph=1' : '';
}
