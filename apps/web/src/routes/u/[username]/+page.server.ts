import { indexingPolicy } from '#lib/seo/policy.js';
import { siteOf } from '@mesaaberta/core/server/site';
import { error, fail, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { requireUser } from '#lib/server/auth/guard.js';
import { failFrom } from '#lib/server/fail-from.js';
import { validateStringForm } from '#lib/forms/contract.js';
import { writeViaApi } from '#lib/server/api-write.js';
import { NotFound } from '@mesaaberta/core/server/errors';
import { routes } from '@mesaaberta/core/routes';
import { normalizeUsername } from '@mesaaberta/core/profile/username';
import { pageNumber } from '@mesaaberta/core/admin/catalog';

import type { publicProfile } from '@mesaaberta/core/server/profile/public';
import { callApiRaw } from '#lib/server/api-client.js';
import { badgeVisibilitySchema } from '#lib/badges/visibility.js';
import { followAction } from '#lib/server/follows/action.js';
import { directoryEnabled, directoryLinksEnabled } from '#lib/server/directories/flags.js';
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
  const [badgesOn, participantOn, favoritesOn, tableRoleOn, followsOn, linksOn, reviewOn] =
    await Promise.all([
      locals.flags.isEnabled('use_badges', subject),
      locals.flags.isEnabled('use_player_ratings', subject),
      locals.flags.isEnabled('use_signed_in_home', subject),
      // The role tag shows to whoever Quem mestra is on for.
      directoryEnabled(locals, 'gms'),
      followsEnabled(locals, viewer),
      // "Mestra em" and "Cuida de".
      directoryLinksEnabled(locals),
      locals.flags.isEnabled('use_year_review', subject),
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
      hostedAt: linksOn ? (data.profile.hostedAt ?? []) : [],
      looksAfter: linksOn ? (data.profile.looksAfter ?? []) : [],
    },
    follow,
    followers: previewing ? null : followers,
    isOwner: data.isOwner && !previewing,
    // The owner's Retrospectiva of this year (`use_year_review`).
    reviewYear: reviewOn && data.isOwner && !previewing ? new Date().getUTCFullYear() : null,
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
    const profile = await locals.getProfile();
    if (!profile || profile.username !== normalizeUsername(params.username))
      error(403, 'Forbidden');
    const form = validateStringForm(await request.formData(), badgeVisibilitySchema, [
      'badgeId',
      'hidden',
    ]);
    if (!form.valid) return fail(400, { form });
    try {
      await writeViaApi(
        locals,
        user,
        `/v1/me/badges/${encodeURIComponent(form.data.badgeId)}/hidden`,
        { hidden: form.data.hidden === '1' },
      );
    } catch (cause) {
      if (cause instanceof NotFound)
        return fail(404, { form: { ...form, valid: false, errors: { badgeId: ['not_found'] } } });
      throw cause;
    }
    return { form };
  },

  // "Mandar mensagem": the direct conversation with this person.
  message: async ({ locals, params, url }) => {
    await requireUser(locals, new URL(url.pathname, url));
    try {
      const profile = await locals.getProfile();
      if (!profile) error(403, 'Forbidden');
      const written = await writeViaApi(
        locals,
        profile,
        `/v1/messages/users/${encodeURIComponent(normalizeUsername(params.username))}`,
        {},
      );
      if (typeof written.body.conversationId !== 'string') error(503, 'Invalid API response');
      redirect(303, `/m/${written.body.conversationId}`);
    } catch (cause) {
      if (isRedirect(cause) || isHttpError(cause)) throw cause;
      if (cause instanceof NotFound) error(404, 'Not found');
      return failFrom(cause);
    }
  },
};
