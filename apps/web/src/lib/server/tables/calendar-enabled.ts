import { can } from '@mesaaberta/core/server/auth/policy';

/** Whether "Adicionar à agenda" is on for the person (`use_table_calendar`), by their id. */
export async function tableCalendarEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Parameters<typeof can>[0] & { id: string }) | null,
): Promise<boolean> {
  if (!profile) return false;
  return locals.flags.isEnabled('use_table_calendar', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}
