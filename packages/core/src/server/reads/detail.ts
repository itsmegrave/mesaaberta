import { eq } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { can, joinBlocker, rateBlocker, type Actor } from '../auth/policy';
import { firstSessionEnded, ratingOf } from '../ratings/service';
import { attendanceOf, listRegistrations, registrationStatus } from '../registrations/service';
import { findTableBySlug, joinDetailsOf } from '../tables/queries';
import { hasStarted } from '../tables/schedule';
import { reportTargetsOf } from '../moderation/reports';
import { systemWaitingOf } from '../systems';

/**
 * Everything the table page shows one viewer (null for a visitor), or null when the table is
 * unknown, disabled or someone else's draft: the caller answers the same translated 404. `gmId`
 * and the table id stay on the server and the picture is still a storage path, which the caller
 * turns into a URL with its own Supabase settings. Shared by web's in-process reader and the api's
 * `GET /v1/reads/detail/:slug`.
 */
export async function readDetail(db: AnyDb, profile: Actor | null, slug: string, now: Date) {
  const found = await findTableBySlug(
    db,
    slug,
    now,
    profile && { id: profile.id, admin: can(profile, 'admin:access') },
  );
  if (!found) return null;

  const { gmId, id, ...table } = found;

  // The player's own place, and the GM's view of everyone's. Names are not public.
  const myStatus = profile ? await registrationStatus(db, id, profile.id) : null;
  const manage = can(profile, 'registration:manage', { gmId });
  const canJoin =
    joinBlocker(profile, {
      gmId,
      tableStatus: found.status,
      started: hasStarted(found.startsAt, now),
      seatsLeft: table.seatsLeft,
      alreadyRegistered: myStatus !== null,
    }) === null;

  // The score is public (it comes with the table); the comment goes to no one but its author.
  const mine = profile ? await ratingOf(db, id, profile.id) : null;
  const attended =
    profile && myStatus === 'confirmed'
      ? await attendanceOf(db, id, profile.id)
      : { attended: null, ratingOpened: false };
  // A rating is final: once given there is nothing left to do, only to show it.
  const canRate =
    !mine &&
    rateBlocker(profile, {
      gmId,
      registration: myStatus,
      tableStatus: found.status,
      firstSessionEnded: firstSessionEnded(found, now),
      attended: attended.attended,
      ratingOpened: attended.ratingOpened,
    }) === null;

  const [gm] = await db
    .select({
      enabled: profiles.directMessagesEnabled,
      username: profiles.username,
      status: profiles.status,
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
    })
    .from(profiles)
    .where(eq(profiles.id, gmId));
  const gmActive = gm?.status === 'active';

  return {
    gmUsername: gmActive ? gm.username : null,
    // "Quem mestra" shows the picture beside the handle; the name stays private. Like the table's
    // picture, the uploaded one is still a storage path the caller turns into a URL.
    gmProfile: gmActive ? { avatarUrl: gm.avatarUrl, avatarPath: gm.avatarPath } : null,
    canRate,
    myRating: mine && {
      gmScore: mine.gmScore,
      comment: mine.comment ?? '',
    },
    table,
    canEdit: can(profile, 'table:edit', { gmId, tableStatus: found.status }),
    systemWaiting: found.status === 'draft' ? await systemWaitingOf(db, found.system.slug) : null,
    // Whether the GM takes direct messages: "Falar com o mestre" is off when they do not.
    gmAcceptsDirect: gm?.enabled ?? false,
    isGm: profile?.id === gmId,
    myStatus,
    canJoin,
    registrations: manage ? await listRegistrations(db, profile, slug) : null,
    // What "Denunciar" offers this visitor: the table, and the people they share it with.
    reportTargets: await reportTargetsOf(db, profile, { id, gmId }),
    // How to join is private: only the GM and the confirmed players get it.
    joinDetails:
      profile?.id === gmId || myStatus === 'confirmed' ? await joinDetailsOf(db, id) : null,
  };
}
