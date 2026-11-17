import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether the signed-in Início and what feeds it are on for a person (`use_signed_in_home`): the
 * "Sistemas favoritos" section for its owner, and the favorite systems on a profile for its owner.
 */
export async function signedInHomeEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: Parameters<typeof can>[0] & { id: string },
): Promise<boolean> {
  return locals.flags.isEnabled('use_signed_in_home', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}
