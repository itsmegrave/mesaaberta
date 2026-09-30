import { afterAll, beforeAll, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db';
import {
  events,
  gameTables,
  platforms,
  profiles,
  registrations,
  systems,
  tags,
} from '../db/schema';
import { adminOverview } from './queries';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-09-30T12:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
  test = await createTestDb();
});
afterAll(() => test.close());

it('returns zero counts and an empty recent list on an empty platform', async () => {
  const data = await adminOverview(test.db, now);
  expect(data.people).toEqual({ total: 0, active: 0, suspended: 0, new30d: 0 });
  expect(data.tables).toEqual({ total: 0, active: 0, disabled: 0, online: 0, inPerson: 0, gms: 0 });
  expect(data.seats).toEqual({ confirmed: 0, pending: 0 });
  expect(data.queue).toEqual({ pending: 0, failed: 0 });
  expect(data.recentTables).toEqual([]);
});

it('aggregates statuses independently, counts distinct GMs, limits recent tables and omits private fields', async () => {
  await test.db.insert(profiles).values([
    { id: id(1), createdAt: new Date('2026-08-01') },
    { id: id(2), status: 'suspended', createdAt: new Date('2026-09-01T12:00:00Z') },
    { id: id(3), createdAt: new Date('2026-09-30') },
    { id: id(4), createdAt: new Date('2026-10-01') },
  ]);
  const [system] = await test.db.select().from(systems).limit(1);
  for (let i = 1; i <= 6; i++) {
    await test.db.insert(gameTables).values({
      id: id(10 + i),
      slug: `admin-${i}`,
      title: `Mesa ${i}`,
      gmId: id(1),
      systemId: system.id,
      kind: 'one_shot',
      capacity: 4,
      durationMinutes: 120,
      timezone: 'UTC',
      startsAt: now,
      status: i === 1 ? 'disabled' : 'active',
      modality: i === 2 ? 'in_person' : 'online',
      locationArea: i === 2 ? 'Centro' : null,
      joinDetails: 'PRIVATE',
      welcomeMessage: 'PRIVATE',
      createdAt: new Date(`2026-09-${String(i).padStart(2, '0')}`),
    });
  }
  await test.db.insert(registrations).values([
    { tableId: id(11), playerId: id(2), status: 'confirmed' },
    { tableId: id(12), playerId: id(3), status: 'pending' },
  ]);
  await test.db.insert(events).values([
    { type: 'TableCreated', payload: { private: 'PRIVATE' } },
    { type: 'TableCreated', payload: {}, failedAt: now },
    { type: 'TableCreated', payload: {}, processedAt: now },
  ]);
  await test.db
    .insert(platforms)
    .values({ name: 'Suggestion', slug: 'suggestion', status: 'pending' });
  await test.db.insert(tags).values({ name: 'Rejected', slug: 'rejected', status: 'rejected' });
  const data = await adminOverview(test.db, now);
  expect(data.people).toEqual({ total: 4, active: 3, suspended: 1, new30d: 2 });
  expect(data.tables).toEqual({ total: 6, active: 5, disabled: 1, online: 5, inPerson: 1, gms: 1 });
  expect(data.seats).toEqual({ confirmed: 1, pending: 1 });
  expect(data.queue).toEqual({ pending: 1, failed: 1 });
  expect(data.suggestions).toEqual({ platforms: 1, tags: 0 });
  expect(data.recentTables.map((t) => t.slug)).toEqual([
    'admin-6',
    'admin-5',
    'admin-4',
    'admin-3',
    'admin-2',
  ]);
  expect(JSON.stringify(data)).not.toContain('PRIVATE');
});
