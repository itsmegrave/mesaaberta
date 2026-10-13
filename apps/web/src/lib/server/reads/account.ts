import type { RequestEvent } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';
import { pictureOf, supabaseUrlOf } from '@mesaaberta/core/server/images';
export async function read({ locals }: RequestEvent) {
  const profile = await locals.getProfile();
  return {
    summary: profile
      ? {
          displayName: profile.name ?? profile.username ?? 'Pessoa sem nome',
          username: profile.username,
          avatarUrl: pictureOf(supabaseUrlOf(locals.env), profile),
          isAdmin: can(profile, 'admin:access'),
        }
      : null,
  };
}
