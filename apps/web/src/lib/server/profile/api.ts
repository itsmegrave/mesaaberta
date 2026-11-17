import { error } from '@sveltejs/kit';
import type { profiles } from '@mesaaberta/core/server/db/schema';
import type { loadProfileForm } from '@mesaaberta/core/server/profile/service';
import { callApiRaw } from '../api-client';
import { readFromApi } from '../api-read';

// The person's own profile form from the api Worker (Trello #120): the web Worker reads no database
// for it.

type ProfileForm = NonNullable<Awaited<ReturnType<typeof loadProfileForm>>>;

/** The signed-in person's profile as its form shows it. */
export async function readProfileForm(locals: App.Locals, actorId: string): Promise<ProfileForm> {
  const form = await readFromApi<ProfileForm | null>(locals, actorId, '/v1/me/profile-form');
  if (!form) error(404, 'Not found');
  return form;
}

/** Whether `username` is free for the signed-in person (their own counts as free). */
export async function usernameAvailable(locals: App.Locals, actorId: string, username: string) {
  const { available } = await readFromApi<{ available: boolean }>(
    locals,
    actorId,
    `/v1/me/username-available?username=${encodeURIComponent(username)}`,
  );
  return available;
}

/**
 * Makes sure the signed-in person has a profile, made by the api from their sign-in metadata on
 * first use: it forwards their own access token, which Supabase checks there. Answers the profile
 * (whose `username` says whether the onboarding step is done); a 503 when that cannot be done.
 */
export async function ensureProfileViaApi(
  locals: App.Locals,
): Promise<Pick<typeof profiles.$inferSelect, 'id' | 'username'>> {
  const token = (await locals.supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) error(401, 'Sign in required');
  const answer = await callApiRaw(
    locals.env,
    '/v1/auth/ensure-profile',
    null,
    locals.log,
    {},
    {
      authorization: `Bearer ${token}`,
    },
  );
  const profile = (answer?.body as { result?: string; profile?: unknown } | undefined)?.profile as
    { id?: unknown; username?: unknown } | undefined;
  if (answer?.ok && typeof profile?.id === 'string')
    return {
      id: profile.id,
      username: typeof profile.username === 'string' ? profile.username : null,
    };
  error(503, 'API unavailable');
}
