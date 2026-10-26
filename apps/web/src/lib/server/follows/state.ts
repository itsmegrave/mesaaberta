import { can } from '@mesaaberta/core/server/auth/policy';
import { eq } from 'drizzle-orm';
import { profiles } from '@mesaaberta/core/server/db/schema';
import { followerCount, isFollowing } from '@mesaaberta/core/server/follows/service';

type Profile = Parameters<typeof can>[0] & { id: string };

/** Whether following is on for this person (`use_follows`), or for visitors when there is none. */
export async function followsEnabled(locals: Pick<App.Locals, 'flags'>, profile: Profile | null) {
  return locals.flags.isEnabled(
    'use_follows',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/**
 * What the Seguir button next to someone needs: null when there is no button (the flag is off, or
 * it is the viewer's own profile); `signedIn: false` for a visitor, whose button leads to Entrar.
 */
export async function followState(
  locals: Pick<App.Locals, 'flags' | 'db' | 'getProfile'>,
  targetId: string,
): Promise<{ profileId: string; following: boolean; signedIn: boolean } | null> {
  const profile = await locals.getProfile();
  if (profile?.id === targetId || !locals.db) return null;
  if (!(await followsEnabled(locals, profile))) return null;
  return {
    profileId: targetId,
    signedIn: profile !== null,
    following: profile ? await isFollowing(locals.db, profile.id, targetId) : false,
  };
}

/**
 * The follow part of a public profile: Seguir for anyone else, and for its owner how many follow
 * them (shown to nobody else). Both null where following is off.
 */
export async function profileFollow(
  locals: Pick<App.Locals, 'flags' | 'db' | 'getProfile'>,
  username: string,
  isOwner: boolean,
) {
  if (!locals.db) return { follow: null, followers: null };
  const [target] = await locals.db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username));
  if (!target) return { follow: null, followers: null };
  if (!isOwner) return { follow: await followState(locals, target.id), followers: null };
  const viewer = await locals.getProfile();
  return {
    follow: null,
    followers:
      viewer && (await followsEnabled(locals, viewer))
        ? await followerCount(locals.db, target.id)
        : null,
  };
}
