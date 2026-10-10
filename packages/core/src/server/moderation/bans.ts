// Relative imports only: the Cron Trigger's Worker runs this without SvelteKit's `$lib` alias.
import { and, eq, isNotNull, lte } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { profiles } from '../db/schema';
import { recordEvent } from '../events/outbox';

/**
 * Lifts the temporary bans whose time is up, each with `AccountBanLifted` (no actor: time did it).
 * The Cron runs it; a sign-in and the next request of the person run it for them too, so nobody
 * waits for the Cron. Returns the events to dispatch.
 */
export async function liftExpiredBans(
  db: AnyDb,
  now: Date,
  { profileId }: { profileId?: string } = {},
): Promise<string[]> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const lifted = await t
      .update(profiles)
      .set({ status: 'active', bannedAt: null, bannedUntil: null, banReason: null })
      .where(
        and(
          eq(profiles.status, 'suspended'),
          isNotNull(profiles.bannedUntil),
          lte(profiles.bannedUntil, now),
          profileId ? eq(profiles.id, profileId) : undefined,
        ),
      )
      .returning({ id: profiles.id });
    const ids: string[] = [];
    for (const { id } of lifted)
      ids.push(
        await recordEvent(t, {
          type: 'AccountBanLifted',
          actorId: null,
          payload: { profileId: id },
        }),
      );
    return ids;
  });
}

type Banned = { id: string; status: 'active' | 'suspended'; bannedUntil: Date | null };

/**
 * Whether this profile is barred right now. A temporary ban whose time is up is lifted here and
 * then (the profile is updated in place, so the rest of the request sees it active); that event is
 * returned to dispatch. A closed account (suspended, no ban) stays barred.
 */
export async function stillBanned(
  db: AnyDb,
  profile: Banned,
  now = new Date(),
): Promise<{ banned: boolean; eventIds: string[] }> {
  if (profile.status !== 'suspended') return { banned: false, eventIds: [] };
  if (!profile.bannedUntil || profile.bannedUntil > now) return { banned: true, eventIds: [] };
  const eventIds = await liftExpiredBans(db, now, { profileId: profile.id });
  Object.assign(profile, { status: 'active', bannedAt: null, bannedUntil: null, banReason: null });
  return { banned: false, eventIds };
}
