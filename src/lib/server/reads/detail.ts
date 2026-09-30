import { error, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { profiles } from '../db/schema';
import { can, joinBlocker, rateBlocker } from '../auth/policy';
import { imageUrl, supabaseUrlOf } from '../images';
import { firstSessionEnded, gmRating, ratingOf } from '../ratings/service';
import { listRegistrations, registrationStatus } from '../registrations/service';
import { findTableBySlug, joinDetailsOf } from '../tables/queries';
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
      tableStatus: 'active',
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
      firstSessionEnded: firstSessionEnded(found, new Date()),
    }) === null;

  return {
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
    gmAcceptsDirect: await locals
      .db!.select({ enabled: profiles.directMessagesEnabled })
      .from(profiles)
      .where(eq(profiles.id, gmId))
      .then((rows) => rows[0]?.enabled ?? false),
    isGm: profile?.id === gmId,
    myStatus,
    canJoin,
    registrations: manage ? await listRegistrations(locals.db!, profile, params.slug!) : null,
    // How to join is private: only the GM and the confirmed players get it.
    joinDetails:
      profile?.id === gmId || myStatus === 'confirmed' ? await joinDetailsOf(locals.db!, id) : null,
  };
};
