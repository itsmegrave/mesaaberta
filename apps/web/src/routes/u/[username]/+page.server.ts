import { indexingPolicy } from '#lib/seo/policy.js';
import { siteOf } from '@mesaaberta/core/server/site';
import { error, fail, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { requireUser } from '#lib/server/auth/guard.js';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { failFrom } from '#lib/server/fail-from.js';
import { validateStringForm } from '#lib/forms/contract.js';
import { openDirectConversation } from '#lib/server/messages/open-direct.js';
import { routes } from '@mesaaberta/core/routes';
import { normalizeUsername } from '@mesaaberta/core/profile/username';
import { pageNumber } from '@mesaaberta/core/admin/catalog';

import type { publicProfile } from '@mesaaberta/core/server/profile/public';
import { callApiRaw } from '#lib/server/api-client.js';
import { setBadgeHidden } from '@mesaaberta/core/server/badges/reads';
import { badgeVisibilitySchema } from '#lib/badges/visibility.js';
import { followAction } from '#lib/server/follows/action.js';
import { directoryEnabled } from '#lib/server/directories/flags.js';
import { followsEnabled } from '#lib/server/follows/state.js';
import type { Actions, PageServerLoad } from './$types';

type ProfileRead = NonNullable<Awaited<ReturnType<typeof publicProfile>>>;

export const load: PageServerLoad = async ({ locals, params, setHeaders, url }) => {
  setHeaders({ 'cache-control': 'private, no-store' });
  const user = await locals.getUser();
  const page = pageNumber(url.searchParams.get('page'));
  // The api reads the page (database reads live there now), with no web fallback.
  const answer = await callApiRaw(
    locals.env,
    `/v1/profiles/${encodeURIComponent(params.username)}${page > 1 ? `?page=${page}` : ''}`,
    user?.id ?? null,
    locals.log,
    undefined,
    {},
    'GET',
  );
  if (answer?.status === 404) error(404, 'Not found');
  if (!answer?.ok) error(503, 'Service unavailable');
  const { subject, follows, ...remote } = answer.body as ProfileRead;
  // JSON turned the dates into strings; the page gets them as dates.
  const data = {
    ...remote,
    tables: remote.tables.map((table) => ({ ...table, startsAt: new Date(table.startsAt) })),
    reviews: remote.reviews.map((review) => ({
      ...review,
      createdAt: new Date(review.createdAt),
    })),
  };
  const path = routes.profile(data.profile.username);
  if (params.username !== data.profile.username) redirect(308, `${path}${url.search}`);

  // The api reads every flag-gated part; the rollouts are by the profile shown, so everyone sees
  // the same strip on a given profile. Follows are targeted by the viewer.
  const viewer = user ? await locals.getProfile().catch(() => null) : null;
  const [badgesOn, participantOn, favoritesOn, tableRoleOn, followsOn] = await Promise.all([
    locals.flags.isEnabled('use_badges', subject),
    locals.flags.isEnabled('use_player_ratings', subject),
    locals.flags.isEnabled('use_signed_in_home', subject),
    // The role tag shows to whoever Quem mestra is on for.
    directoryEnabled(locals, 'gms'),
    followsEnabled(locals, viewer),
  ]);
  // "Ver como visitante": the owner sees the page as anyone else does.
  const previewing = data.isOwner && url.searchParams.get('as') === 'visitor';
  // Seguir for anyone else; for the owner, how many follow them (shown to nobody else).
  const follow =
    followsOn && follows && !data.isOwner
      ? { profileId: subject.id, signedIn: viewer !== null, following: follows.following }
      : null;
  const followers = followsOn && follows && data.isOwner && viewer ? follows.followers : null;
  return {
    ...data,
    badges: badgesOn ? data.badges : null,
    profile: {
      ...data.profile,
      participantRating: participantOn ? data.profile.participantRating : null,
      favoriteSystems: favoritesOn ? data.profile.favoriteSystems : null,
      tableRole: tableRoleOn ? data.profile.tableRole : null,
    },
    follow,
    followers: previewing ? null : followers,
    isOwner: data.isOwner && !previewing,
    previewing,
    canonical: indexingPolicy(url, siteOf(locals.env, locals.log).APP_ORIGIN).canonical!,
  };
};

export const actions: Actions = {
  // Seguir / Seguindo.
  follow: followAction,

  // The eye on an earned badge: the owner hides it from their profile, or shows it again.
  badgeVisibility: async ({ locals, params, request, url }) => {
    const user = await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const profile = await locals.getProfile();
    if (!profile || profile.username !== normalizeUsername(params.username))
      error(403, 'Forbidden');
    const form = validateStringForm(await request.formData(), badgeVisibilitySchema, [
      'badgeId',
      'hidden',
    ]);
    if (!form.valid) return fail(400, { form });
    const changed = await setBadgeHidden(
      locals.db,
      user.id,
      form.data.badgeId,
      form.data.hidden === '1',
    );
    if (!changed)
      return fail(404, { form: { ...form, valid: false, errors: { badgeId: ['not_found'] } } });
    return { form };
  },

  // "Mandar mensagem": the direct conversation with this person.
  message: async ({ locals, params, url }) => {
    await requireUser(locals, new URL(url.pathname, url));
    if (!locals.db) error(503, 'Database not configured');
    const [target] = await locals.db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, normalizeUsername(params.username)));
    if (!target) error(404, 'Not found');
    try {
      const conversationId = await openDirectConversation(
        locals,
        await locals.getProfile(),
        target.id,
      );
      redirect(303, `/m/${conversationId}`);
    } catch (cause) {
      if (isRedirect(cause)) throw cause;
      return failFrom(cause);
    }
  },
};
