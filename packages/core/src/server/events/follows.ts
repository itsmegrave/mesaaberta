import { and, eq, gt, ne, notExists, sql, type SQL } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { follows, gameTables, notifications, profiles, registrations } from '../db/schema';
import { seatAvailability } from '../invitations/seats';
import { routes } from '../../routes';
import { NOTIFICATION_KINDS, type TableMetadata } from '../../notifications/kinds';
import type { Handler, StoredEvent } from './types';

/** A person hears that someone started following them at most once per follower in this window. */
export const FOLLOW_NOTICE_COOLDOWN_DAYS = 30;

type FollowersNotice = {
  event: StoredEvent;
  followeeId: string;
  /** The follower's switch that asks for this notice. */
  wants: typeof profiles.followNotifyTables | typeof profiles.followNotifySeats;
  type: 'followed_table_opened' | 'followed_seat_opened';
  metadata: TableMetadata;
  except?: SQL;
};

/**
 * Writes one notice into the bell of each active follower who asked for it, in one statement
 * however many follow. The (event, recipient) index makes a retry add nothing. The actor is the
 * GM, so the notice names who opened the table and never who gave up a seat.
 */
async function tellFollowers(db: AnyDb, notice: FollowersNotice) {
  const { event, followeeId, type, metadata } = notice;
  await db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql`gen_random_uuid()`.as('id'),
          recipientId: follows.followerId,
          actorId: sql`${followeeId}::uuid`.as('actor_id'),
          eventId: sql`${event.id}::uuid`.as('event_id'),
          category: sql`${NOTIFICATION_KINDS[type].category}::notification_category`.as('category'),
          type: sql`${type}`.as('type'),
          icon: sql`null`.as('icon'),
          title: sql`null`.as('title'),
          body: sql`null`.as('body'),
          link: sql`${routes.table(metadata.slug)}`.as('link'),
          metadata: sql`${JSON.stringify(metadata)}::jsonb`.as('metadata'),
          readAt: sql`null`.as('read_at'),
          createdAt: sql`${event.createdAt.toISOString()}::timestamptz`.as('created_at'),
          writtenAt: sql`now()`.as('written_at'),
        })
        .from(follows)
        .innerJoin(profiles, eq(profiles.id, follows.followerId))
        .where(
          and(
            eq(follows.followeeId, followeeId),
            eq(profiles.status, 'active'),
            eq(notice.wants, true),
            notice.except,
          ),
        ),
    )
    .onConflictDoNothing();
}

/** The table, if it is still open to players and its GM can still be followed. */
async function openTable(db: AnyDb, tableId: string, now: Date) {
  const [table] = await db
    .select({
      gmId: gameTables.gmId,
      slug: gameTables.slug,
      title: gameTables.title,
      status: gameTables.status,
      startsAt: gameTables.startsAt,
      gmStatus: profiles.status,
    })
    .from(gameTables)
    .innerJoin(profiles, eq(profiles.id, gameTables.gmId))
    .where(eq(gameTables.id, tableId));
  if (!table || table.status !== 'active' || table.gmStatus !== 'active') return null;
  if (table.startsAt <= now) return null;
  return table;
}

/** "@x começou a seguir você", unless x was already announced to them in the last 30 days. */
async function tellFollowee(db: AnyDb, event: Extract<StoredEvent, { type: 'FollowStarted' }>) {
  const followerId = event.actorId;
  if (!followerId) return;
  const { followeeId } = event.payload;
  const [follower] = await db
    .select({ username: profiles.username, status: profiles.status })
    .from(profiles)
    .innerJoin(
      follows,
      and(eq(follows.followerId, profiles.id), eq(follows.followeeId, followeeId)),
    )
    .where(eq(profiles.id, followerId));
  // Stopped following before this ran, suspended, or no @ to link to: nobody is told.
  if (!follower?.username || follower.status !== 'active') return;
  const [followee] = await db
    .select({ status: profiles.status })
    .from(profiles)
    .where(eq(profiles.id, followeeId));
  if (followee?.status !== 'active') return;

  const since = new Date(event.createdAt.getTime() - FOLLOW_NOTICE_COOLDOWN_DAYS * 86_400_000);
  const [recent] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, followeeId),
        eq(notifications.actorId, followerId),
        eq(notifications.type, 'follow_started'),
        gt(notifications.createdAt, since),
        ne(notifications.eventId, event.id),
      ),
    )
    .limit(1);
  if (recent) return;

  await db
    .insert(notifications)
    .values({
      recipientId: followeeId,
      actorId: followerId,
      eventId: event.id,
      category: NOTIFICATION_KINDS.follow_started.category,
      type: 'follow_started',
      link: routes.profile(follower.username),
      metadata: {},
      createdAt: event.createdAt,
    })
    .onConflictDoNothing({ target: [notifications.eventId, notifications.recipientId] });
}

/**
 * The bell for following (bell only, never e-mail). Followers hear when the person they follow
 * opens a table, and when a seat opens at one of their full tables, each behind its own switch;
 * a person hears who started following them. Suspended accounts are never told and never tell.
 * Only `use_follows` lets anyone follow, so with it off there is nobody to tell.
 */
export const followsHandler: Handler = {
  name: 'follows-v1',
  types: ['TableCreated', 'PlayerLeft', 'FollowStarted'],
  async handle(event, db) {
    if (event.type === 'FollowStarted') return tellFollowee(db, event);
    if (event.type === 'PlayerLeft' && !event.payload.wasFull) return;
    if (event.type !== 'TableCreated' && event.type !== 'PlayerLeft') return;

    const now = new Date();
    const table = await openTable(db, event.payload.tableId, now);
    if (!table) return;
    const metadata: TableMetadata = {
      tableId: event.payload.tableId,
      slug: table.slug,
      title: table.title,
    };

    if (event.type === 'TableCreated') {
      await tellFollowers(db, {
        event,
        followeeId: table.gmId,
        wants: profiles.followNotifyTables,
        type: 'followed_table_opened',
        metadata,
      });
      return;
    }

    // The seat may have been taken again before this ran.
    if ((await seatAvailability(db, event.payload.tableId, now)).available === 0) return;
    await tellFollowers(db, {
      event,
      followeeId: table.gmId,
      wants: profiles.followNotifySeats,
      type: 'followed_seat_opened',
      metadata,
      // Whoever is already at the table, or asked to join, or just left it, needs no notice.
      except: and(
        ne(follows.followerId, event.payload.playerId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(registrations)
            .where(
              and(
                eq(registrations.tableId, event.payload.tableId),
                eq(registrations.playerId, follows.followerId),
              ),
            ),
        ),
      ),
    });
  },
};
