import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, gameTables, profiles, registrations, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { calendarFeedRoutes } from './calendar-feed';
import { meRoutes } from './me';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000f31';
const player = '00000000-0000-4000-8000-000000000f32';
const env = { DATABASE_URL: 'postgres://test' };
const DAY = 86_400_000;

beforeAll(async () => {
  test = await createTestDb();
  const [system] = await test.db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.status, 'approved'))
    .limit(1);
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestra', role: 'member' },
    { id: player, username: 'jogadora', role: 'member' },
  ]);
  const table = {
    kind: 'one_shot',
    capacity: 3,
    durationMinutes: 120,
    timezone: 'America/Sao_Paulo',
    gmId: gm,
    systemId: system.id,
  };
  const now = Date.now();
  const [soon, played, , pending] = await test.db
    .insert(gameTables)
    .values([
      { ...table, slug: 'em-breve', title: 'Em breve', startsAt: new Date(now + 3 * DAY) },
      {
        ...table,
        slug: 'jogada',
        title: 'Jogada',
        status: 'concluded',
        startsAt: new Date(now - 10 * DAY),
      },
      // Too old for the feed.
      {
        ...table,
        slug: 'antiga',
        title: 'Antiga',
        status: 'concluded',
        startsAt: new Date(now - 90 * DAY),
      },
      { ...table, slug: 'pendente', title: 'Pendente', startsAt: new Date(now + 5 * DAY) },
    ] as never)
    .returning({ id: gameTables.id });
  await test.db.insert(registrations).values([
    { tableId: soon.id, playerId: player, status: 'confirmed' },
    { tableId: played.id, playerId: player, status: 'confirmed' },
    { tableId: pending.id, playerId: player, status: 'pending' },
  ] as never);
});
afterAll(() => test.close());

const opener = (() => ({ db: test.db, close: async () => {} })) as never;
const me = (actor: string, body?: unknown) =>
  meRoutes(opener).request(
    '/calendar-feed',
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        [ACTOR_HEADER]: actor,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const feed = (token: string) => calendarFeedRoutes(opener).request(`/${token}`, {}, env);

describe('api calendar feed over a database', () => {
  it('has no feed until the person makes one', async () => {
    expect(await (await me(player)).json()).toEqual({ token: null });
  });

  it('refuses a body without `on`', async () => {
    expect((await me(player, {})).status).toBe(400);
  });

  it('makes a secret, records the event and answers the confirmed tables of the last 60 days', async () => {
    const made = await me(player, { on: true });
    expect(made.status).toBe(200);
    const { token, eventIds } = await made.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(eventIds).toHaveLength(1);
    const [event] = await test.db
      .select()
      .from(events)
      .where(eq(events.type, 'CalendarFeedChanged'));
    expect(event.payload).toEqual({ profileId: player, on: true });
    expect(await (await me(player)).json()).toEqual({ token });

    const answer = await feed(token);
    expect(answer.status).toBe(200);
    const body = await answer.json();
    expect(body.profileId).toBe(player);
    expect(body.tables.map((table: { slug: string }) => table.slug).sort()).toEqual([
      'em-breve',
      'jogada',
    ]);
  });

  it('gives the GM every table they run, played or not, inside the window', async () => {
    const { token } = await (await me(gm, { on: true })).json();
    const body = await (await feed(token)).json();
    expect(body.tables.map((table: { slug: string }) => table.slug).sort()).toEqual([
      'em-breve',
      'jogada',
      'pendente',
    ]);
  });

  it('a new secret stops the old address, and turning it off stops both', async () => {
    const { token: first } = await (await me(player)).json();
    const { token: second } = await (await me(player, { on: true })).json();
    expect(second).not.toBe(first);
    expect((await feed(first)).status).toBe(404);
    expect((await feed(second)).status).toBe(200);

    expect(await (await me(player, { on: false })).json()).toMatchObject({ token: null });
    expect((await feed(second)).status).toBe(404);
  });

  it('answers 404 for a malformed secret and for an inactive person', async () => {
    expect((await feed('nope')).status).toBe(404);
    const { token } = await (await me(gm)).json();
    await test.db.update(profiles).set({ status: 'suspended' }).where(eq(profiles.id, gm));
    expect((await feed(token)).status).toBe(404);
  });
});
