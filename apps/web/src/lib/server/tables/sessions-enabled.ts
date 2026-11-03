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

/**
 * Whether campanha aberta's places per session are on (`use_session_signup`, with Sessões): the
 * places on each session, "Quero jogar esta" and quem mestra's list per session.
 */
export async function sessionSignupEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  const context = profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {};
  return (
    (await locals.flags.isEnabled('use_table_sessions', context)) &&
    (await locals.flags.isEnabled('use_session_signup', context))
  );
}
