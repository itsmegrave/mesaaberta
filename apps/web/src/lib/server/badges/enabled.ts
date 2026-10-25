import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether the badge system is on for a person (`use_badges`): the strip on their profile, the owner
 * view, the bell notices and the feed filter. Awarding itself runs either way, quietly. Targeted by
 * the person's id, so the profile and the bell agree.
 */
export async function badgesEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: Parameters<typeof can>[0] & { id: string },
): Promise<boolean> {
  return locals.flags.isEnabled('use_badges', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}
