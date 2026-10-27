import { can } from '@mesaaberta/core/server/auth/policy';
import { readFromApi } from '../api-read';

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
  locals: App.Locals,
  targetId: string,
): Promise<{ profileId: string; following: boolean; signedIn: boolean } | null> {
  const profile = await locals.getProfile();
  if (profile?.id === targetId) return null;
  if (!(await followsEnabled(locals, profile))) return null;
  const following = profile
    ? (
        await readFromApi<{ following: boolean }>(
          locals,
          profile.id,
          `/v1/follows/${encodeURIComponent(targetId)}`,
        )
      ).following
    : false;
  return { profileId: targetId, signedIn: profile !== null, following };
}

/**
 * The Seguir button on a table's GM row: the same as `followState`, for the GM of the table the api
 * finds by its slug (the GM's id stays out of the table read).
 */
export async function gmFollowState(
  locals: App.Locals,
  slug: string,
): Promise<{ profileId: string; following: boolean; signedIn: boolean } | null> {
  const profile = await locals.getProfile();
  if (!(await followsEnabled(locals, profile))) return null;
  const gm = await readFromApi<{ profileId: string; following: boolean }>(
    locals,
    profile?.id ?? null,
    `/v1/follows/gm/${encodeURIComponent(slug)}`,
  );
  if (profile?.id === gm.profileId) return null;
  return { profileId: gm.profileId, signedIn: profile !== null, following: gm.following };
}
