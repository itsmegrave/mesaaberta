import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether a table's safety tools and content rating are on for this person (`use_table_safety`), or
 * for visitors when there is none: the form fields, the table page section and the list's 18+ rule.
 */
export async function tableSafetyEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  return locals.flags.isEnabled(
    'use_table_safety',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}
