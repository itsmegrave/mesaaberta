import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether quem mestra rating players is on for a person (`use_player_ratings`): the rating card and
 * the request scores for a GM, the "como participante" score on a profile for its owner.
 */
export async function playerRatingsEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: Parameters<typeof can>[0] & { id: string },
): Promise<boolean> {
  return locals.flags.isEnabled('use_player_ratings', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}
