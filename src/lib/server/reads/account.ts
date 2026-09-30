import type { RequestEvent } from '@sveltejs/kit';
import { can } from '../auth/policy';
import { pictureOf, supabaseUrlOf } from '../images';
export async function read({ locals, platform }: RequestEvent) {
  const profile = await locals.getProfile();
  return {
    summary: profile
      ? {
          displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
          username: profile.username,
          avatarUrl: pictureOf(supabaseUrlOf(platform?.env), profile),
          isAdmin: can(profile, 'admin:access'),
        }
      : null,
  };
}
