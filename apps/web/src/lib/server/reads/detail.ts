import type { RequestEvent } from '@sveltejs/kit';
import { imageUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { pendingInvitationFor } from '#lib/server/invitations/api.js';
import type { readDetail } from '@mesaaberta/core/server/reads/detail';
import { readFromApi } from '../api-read';
import { badgesEnabled } from '../badges/enabled';
import { directoryEnabled } from '../directories/flags';

export const read = async ({ locals, params }: RequestEvent) => {
  const user = await locals.getUser();
  const signedIn = user !== null;
  const profile = user ? await locals.getProfile().catch(() => null) : null;
  // The api reads the table (visitors too). Unknown, disabled or someone else's draft: its 404,
  // which becomes the page's.
  const remote = await readFromApi<NonNullable<Awaited<ReturnType<typeof readDetail>>>>(
    locals,
    user?.id ?? null,
    `/v1/reads/detail/${encodeURIComponent(params.slug!)}`,
  );
  // JSON turned the two dates into strings; the page gets them as dates.
  const detail = {
    ...remote,
    table: {
      ...remote.table,
      startsAt: new Date(remote.table.startsAt),
      until: remote.table.until ? new Date(remote.table.until) : null,
    },
  };

  const { imagePath, ...table } = detail.table;
  // An api Worker from before a field answers without it: the page then shows the handle alone,
  // and offers the players' page to whoever got the registrations, as it did before `canManage`.
  const {
    gmProfile = null,
    canManage = detail.registrations !== null,
    badges = null,
    place = null,
    ...rest
  } = detail;
  return {
    ...rest,
    canManage,
    // Signed-in people only, like the rest of the badge system (`use_badges` targets a person).
    badges: badges && profile && (await badgesEnabled(locals, profile)) ? badges : null,
    gm: gmProfile && { avatarUrl: pictureOf(supabaseUrlOf(locals.env), gmProfile) },
    table: { ...table, imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath) },
    signedIn,
    invitation: profile ? await pendingInvitationFor(locals, profile, params.slug!) : null,
    // The "Onde jogar" place it happens at, while the places are on and that place is listed.
    place: place && (await directoryEnabled(locals, 'places')) ? place : null,
  };
};
