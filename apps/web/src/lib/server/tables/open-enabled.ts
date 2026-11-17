import { can } from '@mesaaberta/core/server/auth/policy';

/** Whether the westmarch kind is on for the person (`use_open_tables`), by their id. */
export async function openTablesEnabled(
  locals: Pick<App.Locals, 'flags' | 'getProfile'>,
): Promise<boolean> {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled(
    'use_open_tables',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}
