import { can } from '@mesaaberta/core/server/auth/policy';
import { isFollowing } from '@mesaaberta/core/server/follows/service';

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
