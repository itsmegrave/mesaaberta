import { can } from '@mesaaberta/core/server/auth/policy';
import { Forbidden } from '@mesaaberta/core/server/errors';
import type { RequestEvent } from '@sveltejs/kit';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import type { AnyDb } from '@mesaaberta/core/server/db/client';

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
 * A block or report service behind `use_message_safety`: refused as `Forbidden` while the flag is
 * off for the person, so the action answers the same code as any other refusal.
 */
export const behindSafetyFlag =
  <Data, Result>(
    apply: (db: AnyDb, actor: Actor | null, data: Data, event: RequestEvent) => Promise<Result>,
  ) =>
  async (db: AnyDb, actor: Actor | null, data: Data, event: RequestEvent) => {
    const profile = await event.locals.getProfile();
    if (!(await messageSafetyEnabled(event.locals, profile)))
      throw new Forbidden('use_message_safety');
    return apply(db, actor, data, event);
  };
