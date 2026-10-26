import { and, asc, count, eq, gt, or, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { follows, gameTables, gmInviteBlocks, profiles } from '../db/schema';
import { authorize, type Actor } from '../auth/policy';
import { NotFound } from '../errors';
import { recordEvent } from '../events/outbox';
import { pictureOf } from '../images';
import { FOLLOWING_PAGE_SIZE, type FollowNoticesInput } from '../../follows/schema';

/** Whether either of the two blocked the other from invitations: then neither can follow. */
const blockedBetween = (a: string, b: string) =>
  or(
    and(eq(gmInviteBlocks.playerId, a), eq(gmInviteBlocks.gmId, b)),
    and(eq(gmInviteBlocks.playerId, b), eq(gmInviteBlocks.gmId, a)),
  );

/**
 * The actor follows someone (`follow:create`): no request and no approval. Following someone
 * already followed changes nothing and records nothing; a new follow records `FollowStarted`.
 */
export async function follow(
  db: AnyDb,
  actor: Actor | null,
  followeeId: string,
): Promise<{ eventIds: string[] }> {
  return db.transaction(async (tx) => {
    const t = tx as unknown as AnyDb;
    const [followee] = await t
      .select({ id: profiles.id, status: profiles.status, username: profiles.username })
      .from(profiles)
      .where(eq(profiles.id, followeeId));
    if (!followee) throw new NotFound();
    const [block] = actor
      ? await t
          .select({ gmId: gmInviteBlocks.gmId })
          .from(gmInviteBlocks)
          .where(blockedBetween(actor.id, followeeId))
          .limit(1)
      : [];
    authorize(actor, 'follow:create', {
      followeeId,
      followeeActive: followee.status === 'active' && followee.username !== null,
      blocked: block !== undefined,
    });

    const inserted = await t
      .insert(follows)
      .values({ followerId: actor!.id, followeeId })
      .onConflictDoNothing()
      .returning({ followeeId: follows.followeeId });
    if (inserted.length === 0) return { eventIds: [] };
    const eventId = await recordEvent(t, {
      type: 'FollowStarted',
      actorId: actor!.id,
      payload: { followeeId },
    });
    return { eventIds: [eventId] };
  });
}

/** The actor stops following someone. Nobody is told and nothing is recorded. */
export async function unfollow(db: AnyDb, followerId: string, followeeId: string) {
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));
}

/** Undoes a follow both ways, for a block. Inside the caller's transaction. */
export async function unfollowBothWays(db: AnyDb, a: string, b: string) {
  await db
    .delete(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followeeId, b)),
        and(eq(follows.followerId, b), eq(follows.followeeId, a)),
      ),
    );
}

export async function isFollowing(db: AnyDb, followerId: string, followeeId: string) {
  const [row] = await db
    .select({ followeeId: follows.followeeId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)))
    .limit(1);
  return row !== undefined;
}

/** How many active accounts follow this person. Only its owner is ever shown the number. */
export async function followerCount(db: AnyDb, profileId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(follows)
    .innerJoin(profiles, eq(follows.followerId, profiles.id))
    .where(and(eq(follows.followeeId, profileId), eq(profiles.status, 'active')));
  return row?.total ?? 0;
}

/**
 * "Seguindo": the active people the person follows, newest follow first, a page at a time, each
 * with how many of their tables are open now. Suspended and closed accounts drop out.
 */
export async function listFollowing(
  db: AnyDb,
  followerId: string,
  {
    page = 1,
    now = new Date(),
    supabaseUrl,
  }: { page?: number; now?: Date; supabaseUrl?: string } = {},
) {
  const where = and(
    eq(follows.followerId, followerId),
    eq(profiles.status, 'active'),
    sql`${profiles.username} IS NOT NULL`,
  );
  const openTables = db
    .select({ gmId: gameTables.gmId, open: count().as('open') })
    .from(gameTables)
    .where(and(eq(gameTables.status, 'active'), gt(gameTables.startsAt, now)))
    .groupBy(gameTables.gmId)
    .as('open_tables');
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: profiles.id,
        username: profiles.username,
        name: profiles.name,
        showName: profiles.showName,
        avatarPath: profiles.avatarPath,
        avatarUrl: profiles.avatarUrl,
        openTables: sql<number>`coalesce(${openTables.open}, 0)`.mapWith(Number),
      })
      .from(follows)
      .innerJoin(profiles, eq(follows.followeeId, profiles.id))
      .leftJoin(openTables, eq(openTables.gmId, profiles.id))
      .where(where)
      .orderBy(sql`${follows.createdAt} desc`, asc(profiles.username))
      .limit(FOLLOWING_PAGE_SIZE)
      .offset((page - 1) * FOLLOWING_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(follows)
      .innerJoin(profiles, eq(follows.followeeId, profiles.id))
      .where(where),
  ]);
  return {
    people: rows.map((row) => ({
      id: row.id,
      username: row.username!,
      name: (row.showName && row.name) || null,
      avatarUrl: pictureOf(supabaseUrl, row),
      openTables: row.openTables,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / FOLLOWING_PAGE_SIZE)),
  };
}

/** The two bell switches for people one follows. */
export async function setFollowNotices(db: AnyDb, profileId: string, input: FollowNoticesInput) {
  await db
    .update(profiles)
    .set({ followNotifyTables: input.tables, followNotifySeats: input.seats })
    .where(eq(profiles.id, profileId));
}
