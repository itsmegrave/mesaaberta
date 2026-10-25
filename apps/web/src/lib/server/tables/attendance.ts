import { can } from '@mesaaberta/core/server/auth/policy';

/**
 * Whether the GM is asked who showed up when they confirm a session (`api_attendance`). Off, the
 * confirm step and the rating rules are as they always were.
 */
export async function attendanceOffered(
  locals: App.Locals,
  profile: Awaited<ReturnType<App.Locals['getProfile']>>,
): Promise<boolean> {
  return profile
    ? locals.flags.isEnabled('api_attendance', {
        id: profile.id,
        isAdmin: can(profile, 'admin:access'),
      })
    : false;
}
