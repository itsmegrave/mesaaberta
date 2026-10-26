import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  follows,
  gameTables,
  playerInvitations,
  profileFavoriteSystems,
  profiles,
  registrations,
  systems,
  userBadges,
} from '@mesaaberta/core/server/db/schema';
import { readHome } from '@mesaaberta/core/server/reads/home';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const me = '00000000-0000-4000-8000-000000000c01';
const followed = '00000000-0000-4000-8000-000000000c02';
const other = '00000000-0000-4000-8000-000000000c03';
const fan = '00000000-0000-4000-8000-000000000c04';
const now = new Date('2026-11-01T12:00:00Z');
const day = 86_400_000;
const at = (days: number) => new Date(now.getTime() + days * day);
let favorite = '';
let plain = '';

const table = (
  slug: string,
  gmId: string,
  systemId: string,
  { starts = 7, published = -30, capacity = 4, status = 'active' as const } = {},
) => ({
  id: `00000000-0000-4000-8000-0000000d00${slug.at(-1)}0`,
  slug,
  systemId,
  title: `Mesa ${slug}`,
  kind: 'one_shot' as const,
  capacity,
  startsAt: at(starts),
  publishedAt: at(published),
  durationMinutes: 180,
  timezone: 'America/Sao_Paulo',
  gmId,
  status,
});

beforeAll(async () => {
  test = await createTestDb();
  const [a, b] = await test.db.select({ id: systems.id }).from(systems).limit(2);
  favorite = a.id;
  plain = b.id;
  await test.db.insert(profiles).values([
    { id: me, username: 'eu' },
    { id: followed, username: 'seguida' },
    { id: other, username: 'outra' },
    { id: fan, username: 'fa' },
  ]);
  await test.db.insert(follows).values([
    { followerId: me, followeeId: followed },
    { followerId: fan, followeeId: me },
  ]);
  await test.db.insert(profileFavoriteSystems).values({ profileId: me, systemId: favorite });
  const rows = [
    table('f1', followed, plain),
    table('f3', followed, favorite, { published: -2 }),
    table('s2', other, favorite, { starts: 5 }),
    table('n4', other, plain, { published: -1 }),
    table('o5', other, plain),
    table('x6', other, favorite, { capacity: 1 }),
    table('p7', other, favorite),
    table('m8', me, favorite, { starts: 2 }),
    table('j9', other, plain, { starts: 1 }),
  ];
  await test.db.insert(gameTables).values(rows);
  const id = (slug: string) => rows.find((row) => row.slug === slug)!.id;
  await test.db.insert(registrations).values([
    { tableId: id('x6'), playerId: fan, status: 'confirmed' },
    { tableId: id('p7'), playerId: me, status: 'pending' },
    { tableId: id('m8'), playerId: fan, status: 'pending' },
    { tableId: id('j9'), playerId: me, status: 'confirmed' },
  ]);
  await test.db.insert(playerInvitations).values({
    tableId: id('o5'),
    gmId: other,
    playerId: me,
    expiresAt: at(1),
  });
  await test.db.insert(userBadges).values({
    profileId: followed,
    badgeId: 'first-table',
    awardedAt: at(-3),
    sourceEventId: '00000000-0000-4000-8000-000000000e01',
  });
});
afterAll(() => test.close());

const slugs = (list: { slug: string }[] | null) => list?.map((item) => item.slug) ?? null;

describe('readHome', () => {
  it('sorts open tables into rows, each table in its first row only', async () => {
    const home = (await readHome(test.db, me, now, { follows: true }))!;

    expect(slugs(home.rows.followed)).toEqual(['f1', 'f3']);
    // Full, already asked for, the person's own and joined tables are left out.
    expect(slugs(home.rows.systems)).toEqual(['s2']);
    expect(slugs(home.rows.fresh)).toEqual(['n4']);
    expect(home.rows.systems![0]).toMatchObject({ gmRating: expect.any(Object), tags: [] });
    expect(home.rows.systems![0]).not.toHaveProperty('gmId');
  });

  it('lists what waits on the person, most urgent first, and their next sessions', async () => {
    const home = (await readHome(test.db, me, now, { follows: true }))!;

    expect(home.waiting.items.map((item) => [item.kind, item.slug])).toEqual([
      ['invitation', 'o5'],
      ['requests', 'm8'],
    ]);
    expect(home.sessions.next.map((session) => [session.slug, session.running])).toEqual([
      ['j9', false],
      ['m8', true],
    ]);
    expect(home.sessions.thisWeek).toBe(2);
  });

  it('counts followers and shows news from people followed', async () => {
    const home = (await readHome(test.db, me, now, { follows: true }))!;

    expect(home.account).toMatchObject({ followers: 1, unreadRatings: 0, latestBadge: null });
    expect(home.feed.map((item) => [item.kind, item.username, item.slug ?? item.badgeId])).toEqual([
      ['table', 'seguida', 'f3'],
      ['badge', 'seguida', 'first-table'],
    ]);
    expect(home.favoriteSystems).toHaveLength(1);
    expect(home.following).toBe(1);
  });

  it('drops everything about following when use_follows is off', async () => {
    const home = (await readHome(test.db, me, now, { follows: false }))!;

    expect(home.rows.followed).toBeNull();
    // f3 is in a favorite system, so it moves there; f1 is neither new nor a favorite.
    expect(slugs(home.rows.systems)).toEqual(['s2', 'f3']);
    expect(home.feed).toEqual([]);
    expect(home.account.followers).toBeNull();
    expect(home.following).toBeNull();
  });

  it('suggests people to follow, and the systems to pick from, to someone new', async () => {
    // Outra runs tables where Eu and Fã have seats, and follows nobody.
    const home = (await readHome(test.db, other, now, { follows: true }))!;

    expect(home.suggestions.map((person) => [person.username, person.ran, person.played])).toEqual([
      ['eu', 0, 1],
      ['fa', 0, 1],
    ]);
    expect(home.systemsCatalog?.length).toBeGreaterThan(1);
    expect(home.feed).toEqual([]);
  });
});
