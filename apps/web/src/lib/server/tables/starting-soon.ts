import { can } from '@mesaaberta/core/server/auth/policy';

/** Whether "Começa já" is on for this person (`use_starting_soon`), or for visitors when there is none. */
export async function startingSoonEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  return locals.flags.isEnabled(
    'use_starting_soon',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}
