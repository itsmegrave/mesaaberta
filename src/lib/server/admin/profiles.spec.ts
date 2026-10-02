import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import { gameTables, profiles, ratings, registrations, systems } from '../db/schema';
import { adminActivity, adminProfile, listAdminProfiles } from './profiles';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values(
    Array.from({ length: 25 }, (_, index) => ({
      id: id(index + 1),
      username: index === 0 ? null : `user-${String(index + 1).padStart(2, '0')}`,
      status: index % 2 === 0 ? ('active' as const) : ('suspended' as const),
      name: 'Private name',
      genderOther: 'Private gender',
      createdAt: new Date('2026-09-30'),
    })),
  );
  // A ban that never ends, and one with an end date.
  await test.db.insert(profiles).values([
    {
      id: id(26),
      username: 'banido',
      status: 'suspended',
      bannedAt: new Date('2026-09-01'),
      bannedUntil: null,
      createdAt: new Date('2026-09-29'),
    },
    {
      id: id(27),
      username: 'suspensa',
      status: 'suspended',
      bannedAt: new Date('2026-09-01'),
      bannedUntil: new Date('2026-12-01'),
      createdAt: new Date('2026-09-28'),
    },
  ]);
});
afterAll(() => test.close());
const list = (query = '') => listAdminProfiles(test.db, new URLSearchParams(query));

it('paginates all users with deterministic ordering', async () => {
  const first = await list();
  const second = await list('page=2');
  expect(first.total).toBe(27);
  expect(first.rows).toHaveLength(20);
  expect(second.rows).toHaveLength(7);
  expect(first.rows[0]).toMatchObject({ id: id(25), username: 'user-25', standing: 'active' });
  // The oldest sign-ups come last; the 25 from the same day are ordered by id.
  expect(second.rows.at(-1)).toMatchObject({ id: id(27), username: 'suspensa' });
  expect(second.rows.at(-3)).toMatchObject({ id: id(1), username: null, standing: 'active' });
  expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(27);
});

it('lists what the users table shows: the name, when they joined, and their tables', async () => {
  const [row] = (await list()).rows;
  expect(row).toMatchObject({
    name: 'Private name',
    createdAt: new Date('2026-09-30'),
    playing: 0,
    running: 0,
  });
  expect(Object.keys(row)).not.toContain('genderOther');
});

it('tells a ban that never ends (banned) from one with an end date (suspended)', async () => {
  const all = (await list('size=100')).rows;
  expect(all.find((row) => row.username === 'banido')?.standing).toBe('banned');
  expect(all.find((row) => row.username === 'suspensa')?.standing).toBe('suspended');
  // A closed account, suspended with no ban, is suspended too.
  expect(all.find((row) => row.username === 'user-02')?.standing).toBe('suspended');
});

it('filters active, suspended and banned users, including unfinished onboarding', async () => {
  const active = await list('status=active');
  const suspended = await list('status=suspended');
  const banned = await list('status=banned');
  expect(active.total).toBe(13);
  expect(active.rows.every((row) => row.standing === 'active')).toBe(true);
  expect(active.rows.some((row) => row.username === null)).toBe(true);
  expect(suspended.total).toBe(13);
  expect(suspended.rows.every((row) => row.standing === 'suspended')).toBe(true);
  expect(banned.rows.map((row) => row.username)).toEqual(['banido']);
});

it('combines status with case-insensitive username search and treats wildcards literally', async () => {
  expect((await list('q=USER-02&status=suspended')).rows.map((row) => row.id)).toEqual([id(2)]);
  expect((await list('q=user-02&status=active')).rows).toEqual([]);
  for (const q of ['%', '_', '\\', "' OR 1=1 --"]) {
    expect((await list(new URLSearchParams({ q }).toString())).total).toBe(0);
  }
});

it('bounds pages and page sizes and handles empty results', async () => {
  expect((await list('page=999999999&size=20')).page).toBe(2);
  expect((await list('page=-1&size=1000')).page).toBe(1);
  expect((await list('page=-1&size=1000')).pageSize).toBe(20);
  expect((await list('page=2&size=50')).rows).toHaveLength(27);
  expect(await list('q=not-found&page=8')).toMatchObject({ total: 0, rows: [], page: 1 });
});

it('loads a selected profile by ID, even when suspended or without a username', async () => {
  expect(await adminProfile(test.db, id(2))).toMatchObject({
    id: id(2),
    username: 'user-02',
    status: 'suspended',
  });
  expect(await adminProfile(test.db, id(1))).toMatchObject({ id: id(1), username: null });
  expect(await adminProfile(test.db, id(100))).toBeNull();
  expect(await adminProfile(test.db, id(1))).not.toHaveProperty('genderOther');
});

it('counts what someone plays in and runs, and how they are rated as a GM', async () => {
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const table = (n: number, gmId: string, status: 'active' | 'disabled' = 'active') => ({
    id: id(100 + n),
    slug: `atividade-${n}`,
    title: `Mesa ${n}`,
    kind: 'one_shot' as const,
    capacity: 4,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId,
    systemId: system.id,
    status,
  });
  await test.db
    .insert(gameTables)
    .values([table(1, id(3)), table(2, id(3)), table(3, id(3), 'disabled'), table(4, id(5))]);
  await test.db.insert(registrations).values([
    { tableId: id(104), playerId: id(3), status: 'confirmed' },
    { tableId: id(101), playerId: id(7), status: 'pending' },
    // The ratings come from confirmed seats.
    { tableId: id(101), playerId: id(9), status: 'confirmed' },
    { tableId: id(102), playerId: id(9), status: 'confirmed' },
  ]);
  await test.db.insert(ratings).values([
    { tableId: id(101), playerId: id(9), gmScore: 5 },
    { tableId: id(102), playerId: id(9), gmScore: 4 },
  ]);

  expect(await adminActivity(test.db, id(3))).toEqual({
    playing: 1,
    running: 2,
    ratings: 2,
    rating: 4.5,
  });
  // A pending request is not a seat, and nobody rated them yet.
  expect(await adminActivity(test.db, id(7))).toEqual({
    playing: 0,
    running: 0,
    ratings: 0,
    rating: null,
  });
});
