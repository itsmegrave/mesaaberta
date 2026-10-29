import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  events,
  gameTables,
  profileFavoriteSystems,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { playerRoutes } from './players';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000f21';
const bia = '00000000-0000-4000-8000-000000000f22';
const old = '00000000-0000-4000-8000-000000000f23';
const env = { DATABASE_URL: 'postgres://test' };
let system: { id: string; slug: string; name: string };

beforeAll(async () => {
  test = await createTestDb();
  [system] = await test.db
    .select({ id: systems.id, slug: systems.slug, name: systems.name })
    .from(systems)
    .where(eq(systems.status, 'approved'))
    .limit(1);
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member', name: 'Bia Souza', showName: true },
    // Said so long ago that the list no longer shows them.
    {
      id: old,
      username: 'velho',
      role: 'member',
      lookingForTableAt: new Date('2020-01-01T00:00:00Z'),
    },
  ]);
  await test.db.insert(profileFavoriteSystems).values({ profileId: bia, systemId: system.id });
  // Bia played one table already; a pending request on another does not count.
  const table = {
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 3,
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: ana,
    systemId: system.id,
  };
  const [played, future] = await test.db
    .insert(gameTables)
    .values([
      { ...table, slug: 'mesa-jogada', startsAt: new Date('2025-01-01T20:00:00Z') },
      { ...table, slug: 'mesa-futura', startsAt: new Date('2099-01-01T20:00:00Z') },
    ] as never)
    .returning({ id: gameTables.id });
  await test.db.insert(registrations).values([
    { tableId: played.id, playerId: bia, status: 'confirmed' },
    { tableId: future.id, playerId: bia, status: 'pending' },
  ] as never);
});
afterAll(() => test.close());

const app = () => playerRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string | null, body?: unknown) =>
  app().request(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(actor ? { [ACTOR_HEADER]: actor } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

describe('api Procuro mesa routes over a database', () => {
  it('is for signed-in people only', async () => {
    expect((await call('/', null)).status).toBe(401);
  });

  it('lists nobody until someone says they are looking; an old one has expired', async () => {
    const body = await (await call('/', ana)).json();
    expect(body).toMatchObject({ total: 0, people: [], me: { looking: false, note: '' } });
  });

  it('turns it on with a note, records the event and lists the person with their systems', async () => {
    const saved = await call('/looking', bia, { looking: true, note: '  Terror,   online  ' });
    expect(saved.status).toBe(200);
    expect((await saved.json()).eventIds).toHaveLength(1);
    const [event] = await test.db
      .select()
      .from(events)
      .where(eq(events.type, 'PlayerLookingChanged'));
    expect(event.payload).toEqual({ profileId: bia, looking: true });

    const body = await (await call('/', ana)).json();
    expect(body.total).toBe(1);
    expect(body.people[0]).toMatchObject({
      username: 'bia',
      name: 'Bia Souza',
      note: 'Terror, online',
      played: 1,
      systems: [{ slug: system.slug, name: system.name }],
    });
    expect(body.systems).toEqual([{ slug: system.slug, name: system.name }]);
    expect((await (await call('/', bia)).json()).me).toMatchObject({
      looking: true,
      note: 'Terror, online',
    });
  });

  it('filters by text and by a favorite system, and a page past the last is a 404', async () => {
    expect((await (await call('/?q=terror', ana)).json()).total).toBe(1);
    expect((await (await call('/?q=nada', ana)).json()).total).toBe(0);
    expect((await (await call(`/?system=${system.slug}`, ana)).json()).total).toBe(1);
    expect((await call('/?page=2', ana)).status).toBe(404);
  });

  it('hides the systems of someone who keeps them off their profile', async () => {
    await test.db.update(profiles).set({ showFavoriteSystems: false }).where(eq(profiles.id, bia));
    const body = await (await call('/', ana)).json();
    expect(body.people[0].systems).toEqual([]);
    expect(body.systems).toEqual([]);
    expect((await (await call(`/?system=${system.slug}`, ana)).json()).total).toBe(0);
  });

  it('refuses a note that is too long, and turns it off keeping the note', async () => {
    const long = await call('/looking', bia, { looking: true, note: 'x'.repeat(201) });
    expect(long.status).toBe(400);
    expect(await long.json()).toMatchObject({ field: 'note', message: 'too_long' });

    await call('/looking', bia, { looking: false, note: 'Terror, online' });
    expect((await (await call('/', ana)).json()).total).toBe(0);
    expect((await (await call('/', bia)).json()).me).toMatchObject({
      looking: false,
      note: 'Terror, online',
    });
  });
});
