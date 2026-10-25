import { error, type RequestEvent } from '@sveltejs/kit';
import { imageUrl, pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
import { pendingInvitationFor } from '#lib/server/invitations/api.js';
import { readDetail } from '@mesaaberta/core/server/reads/detail';
import { readViaApi } from '../api-read';

export const read = async ({ locals, params }: RequestEvent) => {
  const signedIn = (await locals.getUser()) !== null;
  const profile = await locals.getProfile().catch(() => null);
  // Unknown, disabled, someone else's draft, or no database at all: the same translated 404.
  if (!locals.db) error(404, 'Not found');

  // Through the api Worker when `api_reads_detail` is on for the signed-in person (visitors stay
  // here: a flag needs someone to target); here otherwise, which is also where a refusal ends in
  // the page's own 404.
  const remote = profile
    ? await readViaApi<NonNullable<Awaited<ReturnType<typeof readDetail>>>>(
        locals,
        'api_reads_detail',
        profile,
        `/v1/reads/detail/${encodeURIComponent(params.slug!)}`,
      )
    : null;
  // JSON turned the two dates into strings; the page gets them as dates either way.
  const detail = remote
    ? {
        ...remote,
        table: {
          ...remote.table,
          startsAt: new Date(remote.table.startsAt),
          until: remote.table.until ? new Date(remote.table.until) : null,
        },
      }
    : await readDetail(locals.db, profile, params.slug!, new Date());
  if (!detail) error(404, 'Not found');

  const { imagePath, ...table } = detail.table;
  // An api Worker from before the field answers without it; the page then shows the handle alone.
  const { gmProfile = null, ...rest } = detail;
  return {
    ...rest,
    gm: gmProfile && { avatarUrl: pictureOf(supabaseUrlOf(locals.env), gmProfile) },
    table: { ...table, imageUrl: imageUrl(supabaseUrlOf(locals.env), imagePath) },
    signedIn,
    invitation: profile ? await pendingInvitationFor(locals, profile, params.slug!) : null,
  };
};
