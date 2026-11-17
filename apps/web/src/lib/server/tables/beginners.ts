import { error } from '@sveltejs/kit';
import { can } from '@mesaaberta/core/server/auth/policy';

/** Whether Iniciantes is on for the person reading (`use_beginner_tables`), or for visitors. */
export async function beginnersEnabled(locals: Pick<App.Locals, 'flags' | 'getProfile'>) {
  const profile = await locals.getProfile();
  return locals.flags.isEnabled(
    'use_beginner_tables',
    profile ? { id: profile.id, isAdmin: can(profile, 'admin:access') } : {},
  );
}

/** The "Primeira mesa" guide answers 404 while Iniciantes is off for the person reading. */
export async function requireBeginners(locals: Pick<App.Locals, 'flags' | 'getProfile'>) {
  if (!(await beginnersEnabled(locals))) error(404, 'Not found');
}
