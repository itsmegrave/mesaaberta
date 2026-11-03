import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether Sessões is on (`use_table_sessions`) for this person, or for visitors when there is none:
 * the list on the table page, Gerenciar mesa → Sessões and its four actions.
 */
export async function tableSessionsEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  return locals.flags.isEnabled(
    'use_table_sessions',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}
