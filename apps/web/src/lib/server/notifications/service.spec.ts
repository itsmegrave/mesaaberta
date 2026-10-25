import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { notifications, profiles } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { NotFound } from '@mesaaberta/core/server/errors';
import {
  FEED_LIMIT,
  listNotifications,
  markAllRead,
  markRead,
  notificationPage,
  NOTIFICATION_RETENTION_DAYS,
  pruneNotifications,
  unreadCount,
} from '@mesaaberta/core/server/notifications/service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000b01';
const bia = '00000000-0000-4000-8000-000000000b02';
const t0 = new Date('2026-10-01T12:00:00Z');
const minutes = (n: number) => new Date(t0.getTime() + n * 60_000);
const metadata = { tableId: 't', slug: 'mesa', title: 'Mesa do Dragão' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
  ]);
});
afterAll(() => test.close());
beforeEach(async () => {
  await test.db.delete(notifications);
});

const add = async (
  over: Partial<typeof notifications.$inferInsert> & { recipientId: string },
): Promise<string> => {
  const [row] = await test.db
    .insert(notifications)
    .values({
      category: 'table',
      type: 'table_updated',
      link: '/t/mesa',
      metadata,
      createdAt: t0,
      ...over,
    })
    .returning({ id: notifications.id });
  return row.id;
};

describe('badge notices before the badges are released', () => {
  it('leaves them out of the feed, the bell and the count unless asked for', async () => {
    await add({ recipientId: ana, type: 'table_updated' });
    await add({
      recipientId: ana,
      category: 'achievements',
      type: 'badge_earned',
      metadata: { badgeId: 'first-table' },
    });

    expect(await listNotifications(test.db, ana)).toHaveLength(2);
    expect(await unreadCount(test.db, ana)).toBe(2);

    const hidden = await listNotifications(test.db, ana, { withAchievements: false });
    expect(hidden.map((item) => item.type)).toEqual(['table_updated']);
    expect(await unreadCount(test.db, ana, { withAchievements: false })).toBe(1);
  });
});

describe('listNotifications', () => {
  it('lists only the recipient’s own, newest first, with who did it', async () => {
    await add({ recipientId: ana, createdAt: minutes(1) });
    await add({
      recipientId: ana,
      actorId: bia,
      category: 'registration',
      type: 'join_requested',
      createdAt: minutes(2),
    });
    await add({ recipientId: bia });

    const feed = await listNotifications(test.db, ana);

    expect(feed.map((item) => item.type)).toEqual(['join_requested', 'table_updated']);
    expect(feed[0]).toMatchObject({ actor: 'bia', metadata, link: '/t/mesa', read: false });
    expect(feed[1].actor).toBeNull();
  });

  it('filters by category and caps how many it returns', async () => {
    await add({ recipientId: ana, createdAt: minutes(1) });
    await add({
      recipientId: ana,
      category: 'rating',
      type: 'rating_received',
      createdAt: minutes(2),
    });
    await add({ recipientId: ana, createdAt: minutes(3) });

    expect(await listNotifications(test.db, ana, { category: 'rating' })).toHaveLength(1);
    expect(await listNotifications(test.db, ana, { limit: 2 })).toHaveLength(2);
  });
});

describe('reading', () => {
  it('counts the unread ones and marks one as read, only for its recipient', async () => {
    const mine = await add({ recipientId: ana });
    await add({ recipientId: ana });
    const theirs = await add({ recipientId: bia });

    expect(await unreadCount(test.db, ana)).toBe(2);
    expect(await markRead(test.db, ana, mine, t0)).toMatchObject({ link: '/t/mesa' });
    expect(await markRead(test.db, ana, theirs, t0)).toBeNull();

    expect(await unreadCount(test.db, ana)).toBe(1);
    expect(await unreadCount(test.db, bia)).toBe(1);
  });

  it('leaves unread what was written after the page the person marked from', async () => {
    const seen = await add({ recipientId: ana, writtenAt: minutes(1) });
    // A late handler: the event is older than the page, the row was written after it.
    const late = await add({ recipientId: ana, createdAt: t0, writtenAt: minutes(10) });

    await markAllRead(test.db, ana, minutes(11), { until: minutes(5) });

    const byId = new Map((await listNotifications(test.db, ana)).map((item) => [item.id, item]));
    expect(byId.get(seen)?.read).toBe(true);
    expect(byId.get(late)?.read).toBe(false);
  });

  it('marks all of a person’s as read, and leaves the first read time alone', async () => {
    const early = await add({ recipientId: ana, readAt: t0 });
    await add({ recipientId: ana });
    await add({ recipientId: bia });

    await markAllRead(test.db, ana, minutes(5));

    expect(await unreadCount(test.db, ana)).toBe(0);
    expect(await unreadCount(test.db, bia)).toBe(1);
    const feed = await listNotifications(test.db, ana);
    expect(feed.find((item) => item.id === early)?.readAt).toEqual(t0);
  });
});

describe('notificationPage', () => {
  it('pages the feed newest first, and answers NotFound past the last page', async () => {
    await test.db.insert(notifications).values(
      Array.from({ length: FEED_LIMIT + 3 }, (_, i) => ({
        recipientId: ana,
        category: 'table' as const,
        type: 'table_updated',
        metadata,
        createdAt: minutes(i),
      })),
    );

    const first = await notificationPage(test.db, ana, 1);
    expect(first).toMatchObject({ page: 1, pages: 2 });
    expect(first.items).toHaveLength(FEED_LIMIT);
    expect(first.items[0].createdAt).toEqual(minutes(FEED_LIMIT + 2));
    const second = await notificationPage(test.db, ana, 2);
    expect(second.items.map((item) => item.createdAt)).toEqual([
      minutes(2),
      minutes(1),
      minutes(0),
    ]);
    await expect(notificationPage(test.db, ana, 3)).rejects.toThrow(NotFound);
  });

  it('combines the unread filter with a category, and still has a first page when empty', async () => {
    const read = await add({ recipientId: ana, createdAt: minutes(1) });
    await markRead(test.db, ana, read);
    await add({ recipientId: ana, createdAt: minutes(2) });
    await add({
      recipientId: ana,
      category: 'rating',
      type: 'rating_received',
      createdAt: minutes(3),
    });

    const unreadTables = await notificationPage(test.db, ana, 1, {
      category: 'table',
      unread: true,
    });
    expect(unreadTables.items).toHaveLength(1);
    expect(unreadTables.items[0].createdAt).toEqual(minutes(2));
    expect(await notificationPage(test.db, bia, 1)).toMatchObject({ items: [], pages: 1 });
  });
});

describe('pruneNotifications', () => {
  it('deletes the ones older than the retention period, read or not', async () => {
    const days = (n: number) => new Date(t0.getTime() - n * 24 * 3600 * 1000);
    await add({ recipientId: ana, createdAt: days(NOTIFICATION_RETENTION_DAYS + 1) });
    await add({ recipientId: ana, createdAt: days(NOTIFICATION_RETENTION_DAYS + 1), readAt: t0 });
    await add({ recipientId: ana, createdAt: days(NOTIFICATION_RETENTION_DAYS - 1) });

    expect(await pruneNotifications(test.db, t0)).toBe(2);
    expect(await listNotifications(test.db, ana)).toHaveLength(1);
  });
});
