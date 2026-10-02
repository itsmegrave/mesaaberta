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
