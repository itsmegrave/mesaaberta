import type { RequestEvent } from '@sveltejs/kit';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { gameTables, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../db/test-db';
import { apiOver } from '../db/test-api';
import { read } from './detail';

vi.mock('#lib/server/invitations/api.js', () => ({
  pendingInvitationFor: vi.fn(async () => null),
}));

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000d01';
const admin = '00000000-0000-4000-8000-000000000d02';
const member = '00000000-0000-4000-8000-000000000d03';
const suspendedGm = '00000000-0000-4000-8000-000000000d04';
type Person = { id: string; role: 'member' | 'admin'; status: 'active' | 'suspended' };
const people: Record<string, Person> = {
  gm: { id: gm, role: 'member', status: 'active' },
  admin: { id: admin, role: 'admin', status: 'active' },
  member: { id: member, role: 'member', status: 'active' },
  suspended: { id: suspendedGm, role: 'member', status: 'suspended' },
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values(Object.entries(people).map(([username, p]) => ({ ...p, username })) as never);
  const [system] = await test.db
    .insert(systems)
    .values({ name: 'Sys', slug: 'sys', status: 'approved', position: 1 } as never)
    .returning({ id: systems.id });
  const table = (slug: string, gmId: string) => ({
    slug,
    title: slug,
    kind: 'one_shot',
    capacity: 4,
    status: 'active',
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId,
    systemId: system.id,
  });
  await test.db
    .insert(gameTables)
    .values([table('mesa-gm', gm), table('mesa-suspensa', suspendedGm)] as never);
});
afterAll(() => test.close());

// The api Worker reads the page, over the test database.
const eventFor = (who: Person | null, slug: string) =>
  ({
    locals: {
      env: apiOver(test.db),
      log: { warn: vi.fn() },
      flags: { isEnabled: async () => false },
      getUser: async () => (who ? { id: who.id } : null),
      getProfile: async () => who,
    },
    params: { slug },
  }) as unknown as RequestEvent;

describe('the table page read', () => {
  it.each([
    ['the GM', people.gm, true],
    ['an administrator', people.admin, true],
    ['another member', people.member, false],
    ['a visitor', null, false],
  ])('offers editing and the players page to %s only when allowed', async (_, who, allowed) => {
    const data = await read(eventFor(who, 'mesa-gm'));
    expect(data.canEdit).toBe(allowed);
    expect(data.canManage).toBe(allowed);
    expect(data.registrations !== null).toBe(allowed);
  });

  it('offers neither to a suspended GM, on their own table', async () => {
    const data = await read(eventFor(people.suspended, 'mesa-suspensa'));
    expect(data.canEdit).toBe(false);
    expect(data.canManage).toBe(false);
  });
});
