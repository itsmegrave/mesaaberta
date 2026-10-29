import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether the lista de espera is on for this person (`use_waitlist`), or for visitors when there is
 * none: the line on a full table's page, the GM's list and the two actions.
 */
export async function waitlistEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  return locals.flags.isEnabled(
    'use_waitlist',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}
