import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db';
import { events, follows, gameTables, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { Forbidden, NotFound } from '@mesaaberta/core/server/errors';
import {
  follow,
  followerCount,
  isFollowing,
  listFollowing,
  unfollow,
} from '@mesaaberta/core/server/follows/service';
import { setGmInviteBlock } from '@mesaaberta/core/server/invitations/service';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000008${String(n).padStart(2, '0')}`;
const actor = (n: number) => ({ id: id(n), role: 'member' as const, status: 'active' as const });
const now = new Date('2026-10-26T12:00:00Z');

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bia', name: 'Bia Souza', showName: true },
    { id: id(3), username: 'caio' },
    { id: id(4), username: 'suspensa', status: 'suspended' },
    { id: id(5), username: null },
    { id: id(6), username: 'davi' },
  ]);
});
afterAll(() => test.close());

describe('following', () => {
  it('follows anyone active, once, recording FollowStarted only the first time', async () => {
    const first = await follow(test.db, actor(1), id(2));
    const again = await follow(test.db, actor(1), id(2));

    expect(first.eventIds).toHaveLength(1);
    expect(again.eventIds).toEqual([]);
    expect(await isFollowing(test.db, id(1), id(2))).toBe(true);
    const [event] = await test.db.select().from(events).where(eq(events.id, first.eventIds[0]));
    expect(event).toMatchObject({
      type: 'FollowStarted',
      actorId: id(1),
      payload: { followeeId: id(2) },
    });
  });

  it('never follows oneself, a suspended account, one without an @, or nobody', async () => {
    await expect(follow(test.db, actor(1), id(1))).rejects.toBeInstanceOf(Forbidden);
    await expect(follow(test.db, actor(1), id(4))).rejects.toBeInstanceOf(Forbidden);
    await expect(follow(test.db, actor(1), id(5))).rejects.toBeInstanceOf(Forbidden);
    await expect(follow(test.db, null, id(2))).rejects.toBeInstanceOf(Forbidden);
    await expect(follow(test.db, actor(1), id(99))).rejects.toBeInstanceOf(NotFound);
  });

  it('stops following without telling anyone', async () => {
    await follow(test.db, actor(3), id(2));
    await unfollow(test.db, id(3), id(2));
    expect(await isFollowing(test.db, id(3), id(2))).toBe(false);
  });

  it('counts only active followers', async () => {
    await test.db.insert(follows).values({ followerId: id(4), followeeId: id(2) });
    await follow(test.db, actor(6), id(2));
    expect(await followerCount(test.db, id(2))).toBe(2);
  });

  it('lists the people one follows with their open tables, and pages', async () => {
    const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
    await test.db.insert(gameTables).values({
      slug: 'mesa-da-bia',
      title: 'Mesa da Bia',
      kind: 'one_shot',
      capacity: 4,
      startsAt: new Date('2026-11-01T22:00:00Z'),
      durationMinutes: 180,
      timezone: 'UTC',
      gmId: id(2),
      systemId: system.id,
    });
    await follow(test.db, actor(1), id(3));
    await test.db.insert(follows).values({ followerId: id(1), followeeId: id(4) });

    const list = await listFollowing(test.db, id(1), { now });
    expect(list.total).toBe(2);
    expect(list.people.map((p) => p.username).sort()).toEqual(['bia', 'caio']);
    const bia = list.people.find((p) => p.username === 'bia')!;
    expect(bia).toMatchObject({ name: 'Bia Souza', openTables: 1 });
    expect(list.people.find((p) => p.username === 'caio')!.openTables).toBe(0);
    expect((await listFollowing(test.db, id(1), { now, page: 2 })).people).toEqual([]);
  });

  it('a block undoes following both ways and refuses a new one', async () => {
    await follow(test.db, actor(6), id(1));
    await follow(test.db, actor(1), id(6));

    await setGmInviteBlock(test.db, actor(1), id(6), true, { now });

    expect(await isFollowing(test.db, id(6), id(1))).toBe(false);
    expect(await isFollowing(test.db, id(1), id(6))).toBe(false);
    await expect(follow(test.db, actor(6), id(1))).rejects.toBeInstanceOf(Forbidden);
    await expect(follow(test.db, actor(1), id(6))).rejects.toBeInstanceOf(Forbidden);
  });
});
