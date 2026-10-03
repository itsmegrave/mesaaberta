import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import { gameTables, instagramPosts, profiles, systems } from '../db/schema';
import { TABLE_STATUSES } from '$lib/tables/status-values';
import { listAdminTables } from './tables';
let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T00:00:00Z');
beforeAll(async () => {
  test = await createTestDb();
  const gm = crypto.randomUUID();
  await test.db.insert(profiles).values({ id: gm });
  const [system] = await test.db.select().from(systems).limit(1);
  for (let n = 0; n < 22; n++) {
    const [table] = await test.db
      .insert(gameTables)
      .values({
        gmId: gm,
        systemId: system.id,
        title: n === 0 ? 'Mesa 100%' : `Mesa ${n}`,
        slug: `test-${n}`,
        kind: 'one_shot',
        status: n === 0 ? 'disabled' : 'active',
        startsAt: new Date('2099-01-01'),
        capacity: 5,
        durationMinutes: 180,
        timezone: 'UTC',
        joinDetails: 'PRIVATE',
        createdAt: new Date(now.getTime() + n * 1000),
      })
      .returning();
    if (n === 21)
      await test.db.insert(instagramPosts).values({
        tableId: table.id,
        eventId: crypto.randomUUID(),
        status: 'published',
        permalink: 'https://www.instagram.com/p/test/',
      });
  }
});
afterAll(() => test.close());
it('paginates all admin tables and joins publishing status without private fields', async () => {
  const data = await listAdminTables(test.db, new URLSearchParams(), now);
  expect(data.total).toBe(22);
  expect(data.rows).toHaveLength(20);
  expect(data.rows[0]).toMatchObject({ title: 'Mesa 21', instagramStatus: 'published' });
  expect(JSON.stringify(data)).not.toContain('PRIVATE');
  const last = await listAdminTables(test.db, new URLSearchParams('page=99'), now);
  expect(last.page).toBe(2);
  expect(last.rows).toHaveLength(2);
});
it('counts what each status shows, and tells who runs the table and how many seats are taken', async () => {
  const data = await listAdminTables(test.db, new URLSearchParams(), now);
  expect(data.counts).toMatchObject({ all: 22, active: 21, disabled: 1 });
  expect(data.rows[0]).toMatchObject({ capacity: 5, seats: 0 });
  expect(data.rows[0]).toHaveProperty('gm');
  // The counts follow the search, not the status picked.
  const searched = await listAdminTables(
    test.db,
    new URLSearchParams('q=Mesa 2&status=disabled'),
    now,
  );
  expect(searched.counts.all).toBe(3);
  expect(searched.total).toBe(0);
});

it('filters by the state of the Instagram post and orders by title when asked', async () => {
  const published = await listAdminTables(test.db, new URLSearchParams('instagram=published'), now);
  expect(published.total).toBe(1);
  expect(published.rows[0].title).toBe('Mesa 21');
  expect((await listAdminTables(test.db, new URLSearchParams('instagram=none'), now)).total).toBe(
    21,
  );
  expect((await listAdminTables(test.db, new URLSearchParams('instagram=failed'), now)).total).toBe(
    0,
  );
  const byTitle = await listAdminTables(test.db, new URLSearchParams('sort=title&dir=asc'), now);
  expect(byTitle.rows[0].title).toBe('Mesa 1');
});

it('filters title literally and includes disabled tables for admins', async () => {
  const data = await listAdminTables(test.db, new URLSearchParams('q=100%&status=disabled'), now);
  expect(data.total).toBe(1);
  expect(data.rows[0].title).toBe('Mesa 100%');
  expect((await listAdminTables(test.db, new URLSearchParams('status=active'), now)).total).toBe(
    21,
  );
});

it.each(TABLE_STATUSES)(
  'filters the actual database status %s without treating it as disabled',
  async (status) => {
    const [base] = await test.db.select().from(gameTables).limit(1);
    await test.db
      .insert(gameTables)
      .values({ ...base, id: crypto.randomUUID(), slug: `status-${status}`, status });
    const data = await listAdminTables(test.db, new URLSearchParams({ status }), now);
    expect(data.status).toBe(status);
    expect(data.rows.length).toBeGreaterThan(0);
    expect(data.rows.every((row) => row.status === status)).toBe(true);
  },
);
it('orders by the next session, the tables with none left last, either way', async () => {
  const [gm] = await test.db.select().from(profiles).limit(1);
  const [system] = await test.db.select().from(systems).limit(1);
  const starts: [string, string][] = [
    ['Ordem A', '2099-03-01'],
    ['Ordem B', '2099-02-01'],
    ['Ordem C', '2020-01-01'],
  ];
  for (const [title, date] of starts)
    await test.db.insert(gameTables).values({
      gmId: gm.id,
      systemId: system.id,
      title,
      slug: title.toLowerCase().replace(' ', '-'),
      kind: 'one_shot',
      status: 'active',
      startsAt: new Date(date),
      capacity: 5,
      durationMinutes: 180,
      timezone: 'UTC',
      joinDetails: 'x',
    });
  const titles = async (query: string) =>
    (await listAdminTables(test.db, new URLSearchParams(query), now)).rows.map((row) => row.title);

  expect(await titles('q=Ordem&sort=next&dir=asc')).toEqual(['Ordem B', 'Ordem A', 'Ordem C']);
  expect(await titles('q=Ordem&sort=next&dir=desc')).toEqual(['Ordem A', 'Ordem B', 'Ordem C']);
});
