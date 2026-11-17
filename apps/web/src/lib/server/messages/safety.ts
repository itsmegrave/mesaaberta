import { can } from '@mesaaberta/core/server/auth/policy';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actor } from '@mesaaberta/core/server/auth/policy';

/** Whether blocking and reporting in Mensagens are on for this person (`use_message_safety`). */
export async function messageSafetyEnabled(
  locals: Pick<App.Locals, 'flags'>,
  profile: (Actor & { id: string }) | null,
) {
  if (!profile) return false;
  return locals.flags.isEnabled('use_message_safety', {
    id: profile.id,
    isAdmin: can(profile, 'admin:access'),
  });
}

/**
 * The `allow` of a block or report action behind `use_message_safety`: while the flag is off for
 * the person it is refused as `forbidden`, the same code as any other refusal.
 */
export const safetyAllowed = async (event: RequestEvent) =>
  messageSafetyEnabled(event.locals, await event.locals.getProfile());
