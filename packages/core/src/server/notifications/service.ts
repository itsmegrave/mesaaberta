// Relative imports only: `pruneNotifications` runs in the Cron Trigger's Worker, which is bundled
// without SvelteKit's `#lib` alias.
import { and, count, desc, eq, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import type { AnyDb } from '../db/client';
import { notifications, profiles } from '../db/schema';
import { NotFound } from '../errors';
import type { NotificationCategory } from '../../notifications/kinds';

/** Days a notification stays, read or not. The privacy policy promises this; keep them in step. */
export const NOTIFICATION_RETENTION_DAYS = 90;

/** How many the feed shows on a page, and how many the bell's menu shows. */
export const FEED_LIMIT = 50;
export const BELL_LIMIT = 5;

export type NotificationItem = Awaited<ReturnType<typeof listNotifications>>[number];

/**
 * A person's notifications, newest first, with the username of whoever caused each one (null for
 * an announcement or an account that is gone). Wording happens where they are shown.
 */
type FeedFilter = {
  category?: NotificationCategory;
  /** Only the ones not read yet. */
  unread?: boolean;
  withAchievements?: boolean;
};

const feedWhere = (
  recipientId: string,
  { category, unread, withAchievements = true }: FeedFilter,
) =>
  and(
    eq(notifications.recipientId, recipientId),
    category ? eq(notifications.category, category) : undefined,
    unread ? isNull(notifications.readAt) : undefined,
    // Badge notices wait for the badges to be released (`use_badges`).
    withAchievements ? undefined : ne(notifications.category, 'achievements'),
  );

export async function listNotifications(
  db: AnyDb,
  recipientId: string,
  {
    limit = FEED_LIMIT,
    offset = 0,
    ...filter
  }: FeedFilter & { limit?: number; offset?: number } = {},
) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      category: notifications.category,
      icon: notifications.icon,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      metadata: notifications.metadata,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      actor: profiles.username,
    })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.id, notifications.actorId))
    .where(feedWhere(recipientId, filter))
    // A high alert (reports hid a place) stays on top until it is read.
    .orderBy(
      desc(sql`${notifications.type} = 'place_hidden_alert' and ${notifications.readAt} is null`),
      desc(notifications.createdAt),
      desc(notifications.id),
    )
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    ...row,
    metadata: row.metadata as Record<string, string>,
    read: row.readAt !== null,
  }));
}

/**
 * One page of the feed (`FEED_LIMIT` a page, newest first) and how many pages the filter has. A
 * page past the last is `NotFound`; an empty feed still has its first page.
 */
export async function notificationPage(
  db: AnyDb,
  recipientId: string,
  page: number,
  filter: FeedFilter = {},
) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(notifications)
    .where(feedWhere(recipientId, filter));
  const pages = Math.max(1, Math.ceil(total / FEED_LIMIT));
  if (page > pages) throw new NotFound('no such page');
  const items = await listNotifications(db, recipientId, {
    ...filter,
    offset: (page - 1) * FEED_LIMIT,
  });
  return { items, page, pages };
}

/** The number on the bell. */
export async function unreadCount(
  db: AnyDb,
  recipientId: string,
  { withAchievements = true }: { withAchievements?: boolean } = {},
): Promise<number> {
  const [row] = await db
    .select({ unread: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
        withAchievements ? undefined : ne(notifications.category, 'achievements'),
      ),
    );
  return row?.unread ?? 0;
}

/**
 * Marks one of a person's notifications as read and returns where it points. Null when it is not
 * theirs, or not there any more. A second read keeps the first time.
 */
export async function markRead(
  db: AnyDb,
  recipientId: string,
  id: string,
  now = new Date(),
): Promise<{ link: string | null } | null> {
  const [row] = await db
    .update(notifications)
    .set({ readAt: sql`coalesce(${notifications.readAt}, ${now.toISOString()}::timestamptz)` })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, recipientId)))
    .returning({ link: notifications.link });
  return row ?? null;
}

/**
 * Marks every unread notification of a person as read, in every category and on every page. With
 * `until` (when the page they clicked on was loaded), one written after it stays unread: they have
 * not seen it yet.
 */
export async function markAllRead(
  db: AnyDb,
  recipientId: string,
  now = new Date(),
  { until }: { until?: Date } = {},
) {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
        until ? lte(notifications.writtenAt, until) : undefined,
      ),
    );
}

/** Deletes the notifications older than `NOTIFICATION_RETENTION_DAYS`. Returns how many. */
export async function pruneNotifications(db: AnyDb, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 3600 * 1000);
  const deleted = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, cutoff))
    .returning({ id: notifications.id });
  return deleted.length;
}
