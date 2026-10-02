import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { can, joinBlocker, rateBlocker } from '../auth/policy';
import { imageUrl, supabaseUrlOf } from '../images';
import { firstSessionEnded, gmRating, ratingOf } from '../ratings/service';
import { listRegistrations, registrationStatus } from '../registrations/service';
import { findTableBySlug, joinDetailsOf } from '../tables/queries';
import { reportTargetsOf } from '../moderation/reports';
export const read = async ({ locals, params, platform }: RequestEvent) => {
  // Unknown, disabled, or no database at all: the same translated 404.
  const found = locals.db && (await findTableBySlug(locals.db, params.slug!, new Date()));
  if (!found) error(404, 'Not found');

  const { gmId, id, imagePath, ...table } = found;
  const signedIn = (await locals.getUser()) !== null;
  const profile = await locals.getProfile().catch(() => null);

  // The player's own place, and the GM's view of everyone's. Names are not public.
  const myStatus = profile ? await registrationStatus(locals.db!, id, profile.id) : null;
  const manage = can(profile, 'registration:manage', { gmId });
  const canJoin =
    joinBlocker(profile, {
      gmId,
      tableStatus: found.status,
      seatsLeft: table.seatsLeft,
      alreadyRegistered: myStatus !== null,
    }) === null;

  // Averages are public; the comment is not sent to anyone but its author.
  const [gmScore, mine] = await Promise.all([
    gmRating(locals.db!, gmId),
    profile ? ratingOf(locals.db!, id, profile.id) : null,
  ]);
  const canRate =
    rateBlocker(profile, {
      gmId,
      registration: myStatus,
      tableStatus: found.status,
      firstSessionEnded: firstSessionEnded(found, new Date()),
    }) === null;

  const [gm] = await locals
    .db!.select({
      enabled: profiles.directMessagesEnabled,
      username: profiles.username,
      status: profiles.status,
    })
    .from(profiles)
    .where(eq(profiles.id, gmId));

  return {
    gmUsername: gm?.status === 'active' ? gm.username : null,
    ratings: { gm: gmScore },
    canRate,
    myRating: mine && {
      gmScore: mine.gmScore,
      comment: mine.comment ?? '',
    },
    table: { ...table, imageUrl: imageUrl(supabaseUrlOf(platform?.env), imagePath) },
    canEdit: can(profile, 'table:edit', { gmId }),
    signedIn,
    // Whether the GM takes direct messages: "Falar com o mestre" is off when they do not.
    gmAcceptsDirect: gm?.enabled ?? false,
    isGm: profile?.id === gmId,
    myStatus,
    canJoin,
    registrations: manage ? await listRegistrations(locals.db!, profile, params.slug!) : null,
    // What "Denunciar" offers this visitor: the table, and the people they share it with.
    reportTargets: await reportTargetsOf(locals.db!, profile, { id, gmId }),
    // How to join is private: only the GM and the confirmed players get it.
    joinDetails:
      profile?.id === gmId || myStatus === 'confirmed' ? await joinDetailsOf(locals.db!, id) : null,
  };
};
