import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '@mesaaberta/core/server/db/schema';
import { auditLog } from '@mesaaberta/core/server/moderation/admin';
import { createTestDb } from '../../../../../apps/web/src/lib/server/db/test-db';
import { adminSectionOf, recordAdminEntry } from './entries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = {
  id: '00000000-0000-4000-8000-0000000ad001',
  role: 'admin',
  status: 'active',
} as const;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ ...admin, username: 'admin-ana' });
});
afterAll(() => test.close());

describe('adminSectionOf', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/users', '/admin/users'],
    ['/admin/users/[id]', '/admin/users'],
    ['/admin/[ext]', '/admin'],
  ])('reads %s as %s, with no id in it', (routeId, section) =>
    expect(adminSectionOf(routeId)).toBe(section),
  );
});

describe('recordAdminEntry', () => {
  it('records one entry per section in half an hour, and the audit log lists it under Acessos', async () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 9, 26, 12, minutes));
    const entry = (section: string, minutes: number) =>
      recordAdminEntry(test.db, { actorId: admin.id, section, now: at(minutes) });

    expect(await entry('/admin/users', 0)).not.toBeNull();
    expect(await entry('/admin/users', 10)).toBeNull();
    expect(await entry('/admin/audit', 10)).not.toBeNull();
    expect(await entry('/admin/users', 31)).not.toBeNull();

    const rows = await test.db
      .select({ payload: events.payload })
      .from(events)
      .where(eq(events.type, 'AdminAreaEntered'));
    expect(rows.map((row) => row.payload)).toEqual([
      { section: '/admin/users' },
      { section: '/admin/audit' },
      { section: '/admin/users' },
    ]);

    const access = await auditLog(test.db, admin, new URLSearchParams('kind=access'));
    expect(access?.rows.map((row) => [row.by, row.section])).toEqual([
      ['admin-ana', '/admin/users'],
      ['admin-ana', '/admin/audit'],
      ['admin-ana', '/admin/users'],
    ]);
    // Visits are not decisions: the full log leaves them out.
    const all = await auditLog(test.db, admin, new URLSearchParams());
    expect(all?.rows.some((row) => row.type === 'AdminAreaEntered')).toBe(false);
  });
});
