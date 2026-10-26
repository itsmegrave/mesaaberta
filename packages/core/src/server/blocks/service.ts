import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import {
  conversations,
  notifications,
  playerInvitations,
  profileBlocks,
  profiles,
} from '../db/schema';
import type { Actor } from '../auth/policy';
import { Forbidden, NotFound } from '../errors';
import { unfollowBothWays } from '../follows/service';
import { cancelPendingInvitations, lockInvitationProfiles } from '../invitations/service';
import { pairKey } from '../../messages/schema';

/** Whether `blockerId` blocked `blockedId`. */
export const blocks = (blockerId: string, blockedId: string) =>
  and(eq(profileBlocks.blockerId, blockerId), eq(profileBlocks.blockedId, blockedId));

/** Either of the two blocked the other. */
export const blockedBetween = (a: string, b: string) => or(blocks(a, b), blocks(b, a));

/**
 * How the actor and `otherId` stand: `mine` when the actor blocked them, `theirs` when they blocked
 * the actor (only the server reads that one: the blocked person is never told).
 */
export async function blockState(db: AnyDb, actorId: string, otherId: string) {
  const rows = await db
    .select({ blockerId: profileBlocks.blockerId })
    .from(profileBlocks)
    .where(blockedBetween(actorId, otherId));
  return {
    mine: rows.some((row) => row.blockerId === actorId),
    theirs: rows.some((row) => row.blockerId === otherId),
  };
}

/**
 * The actor blocks or unblocks `profileId`. Blocking ends what joined them: following (both ways)
 * and pending invitations (either way), and takes the unread "new messages" notice of their direct
 * conversation off the actor's bell. Unblocking brings none of it back. Blocking twice, or
 * unblocking someone not blocked, changes nothing. Returns the invitation events to dispatch.
 */
export async function setBlocked(
  db: AnyDb,
  actor: Actor | null,
  profileId: string,
  blocked: boolean,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ eventIds: string[] }> {
  if (!actor || actor.status !== 'active' || actor.id === profileId) throw new Forbidden();
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    // The same profile locks as the invitation writers, so a block and an invitation serialize.
    const found = await lockInvitationProfiles(t, [actor.id, profileId]);
    if (!found.some((profile) => profile.id === profileId)) throw new NotFound();

    if (!blocked) {
      await t.delete(profileBlocks).where(blocks(actor.id, profileId));
      return { eventIds: [] };
    }

    await t
      .insert(profileBlocks)
      .values({ blockerId: actor.id, blockedId: profileId, createdAt: now })
      .onConflictDoNothing();
    await unfollowBothWays(t, actor.id, profileId);
    const [direct] = await t
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.kind, 'direct'),
          eq(conversations.pairKey, pairKey(actor.id, profileId)),
        ),
      );
    if (direct)
      await t
        .delete(notifications)
        .where(
          and(
            eq(notifications.recipientId, actor.id),
            eq(notifications.type, 'message_received'),
            sql`${notifications.metadata}->>'conversationId' = ${direct.id}`,
          ),
        );
    const eventIds = await cancelPendingInvitations(
      t,
      or(
        and(eq(playerInvitations.playerId, actor.id), eq(playerInvitations.gmId, profileId)),
        and(eq(playerInvitations.playerId, profileId), eq(playerInvitations.gmId, actor.id)),
      )!,
      'blocked',
      now,
      actor.id,
    );
    return { eventIds };
  });
}

/** Everyone the actor blocked, by name, for "Pessoas bloqueadas" on the profile form. */
export async function listBlocked(db: AnyDb, actor: Actor | null) {
  if (!actor) throw new Forbidden();
  return db
    .select({
      id: profiles.id,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      avatarPath: profiles.avatarPath,
      blockedAt: profileBlocks.createdAt,
    })
    .from(profileBlocks)
    .innerJoin(profiles, eq(profiles.id, profileBlocks.blockedId))
    .where(eq(profileBlocks.blockerId, actor.id))
    .orderBy(asc(profiles.username));
}
