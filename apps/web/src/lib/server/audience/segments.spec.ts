import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, registrations, systems } from '@mesaaberta/core/server/db/schema';
import {
  countAudience,
  inAudience,
  viewerSegments,
  type ViewerSegments,
} from '@mesaaberta/core/server/audience/segments';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000009${String(n).padStart(2, '0')}`;
const now = new Date('2026-10-25T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
let counter = 0;

const person = (n: number, over: Partial<typeof profiles.$inferInsert> = {}) =>
  test.db
    .insert(profiles)
    .values({ id: id(n), username: `seg${n}`, createdAt: daysAgo(400), ...over });

const table = async (gm: number, over: Partial<typeof gameTables.$inferInsert> = {}) => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const slug = `segmento-${++counter}`;
  const [row] = await test.db
    .insert(gameTables)
    .values({
      slug,
      title: slug,
      kind: 'one_shot',
      capacity: 4,
      startsAt: daysAgo(200),
      durationMinutes: 120,
      timezone: 'UTC',
      gmId: id(gm),
      systemId: system.id,
      status: 'concluded',
      ...over,
    })
    .returning();
  return row;
};

const none: ViewerSegments = { admin: false, gm: false, player: false, recent: false, new: false };

beforeAll(async () => {
  test = await createTestDb();
  await person(1, { role: 'admin' });
  // An old GM whose only table was long ago; a recent GM; a player with a seat last month.
  await person(2);
  await person(3);
  await person(4);
  await person(5, { createdAt: daysAgo(3) });
  await person(6, { status: 'suspended' });
  await person(7, { username: null });
  await table(2);
  await table(3, { startsAt: daysAgo(10) });
  const recent = await table(3, { startsAt: daysAgo(20) });
  await test.db.insert(registrations).values([
    { tableId: recent.id, playerId: id(4), status: 'confirmed' },
    // A request still waiting is not a seat.
    { tableId: recent.id, playerId: id(5), status: 'pending' },
  ]);
  // A campaign that started long ago and still runs makes its GM recent.
  await person(8);
  await table(8, {
    startsAt: daysAgo(300),
    kind: 'campaign',
    recurrence: 'FREQ=WEEKLY',
    status: 'active',
  });
  // A draft opened today counts as having opened a table, but no session was held.
  await person(9);
  await table(9, { startsAt: daysAgo(1), status: 'draft' });
});
afterAll(() => test.close());

describe('viewerSegments', () => {
  it('works each group out from the tables and seats, not from a role', async () => {
    expect(await viewerSegments(test.db, id(1), now)).toEqual({ ...none, admin: true });
    expect(await viewerSegments(test.db, id(2), now)).toEqual({ ...none, gm: true });
    expect(await viewerSegments(test.db, id(3), now)).toEqual({ ...none, gm: true, recent: true });
    expect(await viewerSegments(test.db, id(4), now)).toEqual({
      ...none,
      player: true,
      recent: true,
    });
    expect(await viewerSegments(test.db, id(5), now)).toEqual({ ...none, new: true });
    expect(await viewerSegments(test.db, id(8), now)).toEqual({ ...none, gm: true, recent: true });
    expect(await viewerSegments(test.db, id(9), now)).toEqual({ ...none, gm: true });
  });

  it('aims nothing at a suspended account, one still onboarding, or a stranger', async () => {
    expect(await viewerSegments(test.db, id(6), now)).toBeNull();
    expect(await viewerSegments(test.db, id(7), now)).toBeNull();
    expect(await viewerSegments(test.db, id(99), now)).toBeNull();
  });
});

describe('audiences', () => {
  it('takes anyone in one included group, minus the excluded ones; no group means everyone', () => {
    const gm = { ...none, gm: true, new: true };
    expect(inAudience(gm, { include: [], exclude: [] })).toBe(true);
    expect(inAudience(gm, { include: ['player', 'gm'], exclude: [] })).toBe(true);
    expect(inAudience(gm, { include: ['player'], exclude: [] })).toBe(false);
    expect(inAudience(gm, { include: ['gm'], exclude: ['new'] })).toBe(false);
  });

  it('counts the same people the per-person check would let in', async () => {
    expect(await countAudience(test.db, { include: [], exclude: [] }, now)).toBe(7);
    expect(await countAudience(test.db, { include: ['gm'], exclude: [] }, now)).toBe(4);
    expect(await countAudience(test.db, { include: ['gm'], exclude: ['recent'] }, now)).toBe(2);
    expect(await countAudience(test.db, { include: ['player', 'new'], exclude: [] }, now)).toBe(2);
  });
});
