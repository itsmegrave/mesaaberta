import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import { profiles } from '../db/schema';
import { adminProfile, listAdminProfiles } from './profiles';

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
});
afterAll(() => test.close());
const list = (query = '') => listAdminProfiles(test.db, new URLSearchParams(query));

it('paginates all users with deterministic ordering and only the requested columns', async () => {
  const first = await list();
  const second = await list('page=2');
  expect(first.total).toBe(25);
  expect(first.rows).toHaveLength(20);
  expect(second.rows).toHaveLength(5);
  expect(first.rows[0]).toEqual({ id: id(25), username: 'user-25', status: 'active' });
  expect(second.rows.at(-1)).toEqual({ id: id(1), username: null, status: 'active' });
  expect(new Set([...first.rows, ...second.rows].map((row) => row.id)).size).toBe(25);
});

it('filters active and suspended users, including unfinished onboarding', async () => {
  const active = await list('status=active');
  const suspended = await list('status=suspended');
  expect(active.total).toBe(13);
  expect(active.rows.every((row) => row.status === 'active')).toBe(true);
  expect(active.rows.some((row) => row.username === null)).toBe(true);
  expect(suspended.total).toBe(12);
  expect(suspended.rows.every((row) => row.status === 'suspended')).toBe(true);
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
  expect((await list('page=2&size=50')).rows).toHaveLength(25);
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
