import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, registrations, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { tableCalendarRoutes } from './table-calendar';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000ca1';
const ana = '00000000-0000-4000-8000-000000000ca2';
const bia = '00000000-0000-4000-8000-000000000ca3';
const caio = '00000000-0000-4000-8000-000000000ca4';
const admin = '00000000-0000-4000-8000-000000000ca5';
const banned = '00000000-0000-4000-8000-000000000ca6';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestra-agenda', role: 'member' },
    { id: ana, username: 'ana-agenda', role: 'member' },
    { id: bia, username: 'bia-agenda', role: 'member' },
    { id: caio, username: 'caio-agenda', role: 'member' },
    { id: admin, username: 'admin-agenda', role: 'admin' },
    { id: banned, username: 'banida-agenda', role: 'member', status: 'suspended' },
  ]);
  const [{ id: systemId }] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const base = {
    title: 'Mesa na agenda',
    kind: 'campaign' as const,
    recurrence: 'FREQ=WEEKLY',
    capacity: 4,
    startsAt: new Date('2099-01-03T22:00:00Z'),
    durationMinutes: 240,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
    systemId,
    icalSequence: 3,
  };
  const [going] = await test.db
    .insert(gameTables)
    .values([
      { ...base, slug: 'agenda-ativa', status: 'active' },
      { ...base, slug: 'agenda-concluida', status: 'concluded' },
    ])
    .returning();
  await test.db.insert(registrations).values([
    { tableId: going.id, playerId: ana, status: 'confirmed' },
    { tableId: going.id, playerId: bia, status: 'pending' },
    { tableId: going.id, playerId: banned, status: 'confirmed' },
  ]);
});
afterAll(() => test.close());

const app = () => tableCalendarRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (slug: string, actor: string | null) =>
  app().request(`/${slug}`, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);

describe('api table calendar over a database', () => {
  it('answers the table as the invite carries it to its GM, a confirmed player and an admin', async () => {
    for (const actor of [gm, ana, admin]) {
      const response = await get('agenda-ativa', actor);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        slug: 'agenda-ativa',
        recurrence: 'FREQ=WEEKLY',
        timezone: 'America/Sao_Paulo',
        icalSequence: 3,
      });
      // The GM's id is not part of the event.
      expect(body).not.toHaveProperty('gmId');
    }
  });

  it('is a 404 for a pending request, a stranger, a suspended account and an ended table', async () => {
    for (const actor of [bia, caio, banned]) {
      expect((await get('agenda-ativa', actor)).status).toBe(404);
    }
    expect((await get('agenda-concluida', gm)).status).toBe(404);
    expect((await get('nao-existe', gm)).status).toBe(404);
  });

  it('needs a signed-in person', async () => {
    expect((await get('agenda-ativa', null)).status).toBe(401);
  });
});
