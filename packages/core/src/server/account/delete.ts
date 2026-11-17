import { deleteAuthUser, type SupabaseAdmin } from '../auth/admin-client';
import type { AnyDb } from '../db/client';
import { Invalid } from '../errors';
import { dispatchEvent } from '../events/dispatcher';
import type { Handler } from '../events/types';
import type { Logger } from '../logger';
import { loadProfileForm } from '../profile/service';
import { anonymiseProfile, closeAccount } from './service';

type Deps = { db: AnyDb; admin: SupabaseAdmin; handlers: readonly Handler[]; log: Logger };

/**
 * Closes the signed-in person's account, after they typed their username to confirm (`Invalid` on
 * `confirm` otherwise): the database first (tables disabled, seats and ratings gone), then the
 * calendar cancellations, then the profile is emptied and the Auth user deleted. The web form
 * action and the api route (`POST /v1/account/delete`) both run this. Removing the profile picture
 * from storage is the caller's, with the person's own session, before it calls this.
 */
export async function deleteAccount(
  { db, admin, handlers, log }: Deps,
  userId: string,
  confirm: string,
): Promise<{ tables: number }> {
  const username = (await loadProfileForm(db, userId))?.username;
  if (!username || confirm !== username) throw new Invalid('confirm', 'confirm');

  const { eventIds } = await closeAccount(db, userId);
  // Sent now, while the GM's address still exists; a failure is left to the sweeper.
  for (const id of eventIds) {
    await dispatchEvent(db, handlers, id, new Date(), log).catch((error: unknown) =>
      log.error('account.deletion_dispatch_failed', { error, eventId: id }),
    );
  }
  await anonymiseProfile(db, userId);
  await deleteAuthUser(admin, userId);
  log.info('account.deleted', { tables: eventIds.length });
  return { tables: eventIds.length };
}
