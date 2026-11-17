import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  gameTables,
  matches,
  notifications,
  profiles,
  registrations,
  systems,
} from '@mesaaberta/db/schema';
import {
  matchGraphStats,
  playedPairs,
  remindUnplayedMatches,
} from '@mesaaberta/core/server/matches/graph';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { matchRoutes } from './matches';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-0000000a9c01';
const bia = '00000000-0000-4000-8000-0000000a9c02';
const caio = '00000000-0000-4000-8000-0000000a9c03';
const dora = '00000000-0000-4000-8000-0000000a9c04';
const eva = '00000000-0000-4000-8000-0000000a9c05';
const env = { DATABASE_URL: 'postgres://test' };
const now = new Date('2026-11-12T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values(
    [ana, bia, caio, dora, eva].map((id, i) => ({
      id,
      username: ['ana', 'bia', 'caio', 'dora', 'eva'][i],
      ageRange: '25_34' as const,
      tableRole: i === 0 ? ('gm' as const) : ('player' as const),
    })),
  );
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const table = {
    title: 'Mesa',
    kind: 'one_shot',
    capacity: 4,
    durationMinutes: 60,
    timezone: 'UTC',
    systemId: system.id,
  };
  const tables = await test.db
    .insert(gameTables)
    .values([
      // Played two months ago: Ana ran it, Bia played, Caio was marked absent, Dora only asked.
      { ...table, slug: 'recente', gmId: ana, startsAt: daysAgo(60), status: 'concluded' },
      // Still ahead: nobody has played it yet.
      { ...table, slug: 'futura', gmId: eva, startsAt: new Date('2099-01-01T20:00:00Z') },
      // Played two years ago, before Combinar: Caio ran it for Dora.
      { ...table, slug: 'antiga', gmId: caio, startsAt: daysAgo(700), status: 'concluded' },
    ] as never)
    .returning({ id: gameTables.id, slug: gameTables.slug });
  const id = (slug: string) => tables.find((t) => t.slug === slug)!.id;
  await test.db.insert(registrations).values([
    { tableId: id('recente'), playerId: bia, status: 'confirmed' },
    { tableId: id('recente'), playerId: caio, status: 'confirmed', attended: false },
    { tableId: id('recente'), playerId: dora, status: 'pending' },
    { tableId: id('futura'), playerId: bia, status: 'confirmed' },
    { tableId: id('antiga'), playerId: dora, status: 'confirmed' },
  ]);
});
afterAll(() => test.close());

const app = () => matchRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string, method = 'GET', body?: unknown) =>
  app().request(
    path,
    {
      method,
      headers: {
        [ACTOR_HEADER]: actor,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );
const card = (seeking: string[]) => ({
  enabled: true,
  adult: true,
  seeking,
  online: true,
  inPerson: false,
  combat: 50,
  rules: 50,
  length: 50,
  tone: 50,
});

describe("Combinar's graph over a database", () => {
  it('joins the people of a played table, old ones too, and nobody absent or still waiting', async () => {
    const pairs = await playedPairs(test.db, [ana, bia, caio, dora, eva], null, now);
    const edges = pairs.map((p) => `${p.a.slice(-2)}-${p.b.slice(-2)}:${p.tables}`).sort();
    expect(edges).toEqual(['01-02:1', '02-01:1', '03-04:1', '04-03:1']);
    expect(pairs.find((p) => p.a === ana)!.lastAt).toEqual(daysAgo(60));
  });

  it('lists Quem já jogou comigo, latest first, with a 404 past the last page', async () => {
    const played = await (await call('/played', bia)).json();
    expect(played).toMatchObject({
      total: 1,
      pages: 1,
      items: [{ username: 'ana', tables: 1, tableRole: 'gm' }],
    });
    expect(await (await call('/played', eva)).json()).toMatchObject({ total: 0, items: [] });
    expect((await call('/played?page=2', bia)).status).toBe(404);
  });

  it('keeps recent table-mates out of the deck and puts people in common first, with the graph on', async () => {
    await call('/card', ana, 'POST', card(['players']));
    for (const id of [bia, dora, eva]) await call('/card', id, 'POST', card(['gm']));
    // Dora matched with Bia, whom Ana played with: Dora is two steps from Ana.
    await test.db.insert(matches).values({ profileA: bia, profileB: dora });

    const plain = await (await call('/deck', ana)).json();
    expect(plain.people.map((p: { username: string }) => p.username).sort()).toEqual([
      'bia',
      'dora',
      'eva',
    ]);
    const graph = await (await call('/deck?graph=1', ana)).json();
    expect(graph.people.map((p: { username: string }) => p.username)).toEqual(['dora', 'eva']);
    expect(graph.people[0].commonPeople).toBe(1);
    expect(graph.people[1].commonPeople).toBe(0);
  });

  it('reminds a match that has not played, twice at most, and stops once they play', async () => {
    await test.db.delete(matches);
    const [unplayed] = await test.db
      .insert(matches)
      .values({ profileA: ana, profileB: eva, createdAt: daysAgo(31) })
      .returning({ id: matches.id });
    // Matched before the table they then played together.
    const [played] = await test.db
      .insert(matches)
      .values({ profileA: ana, profileB: bia, createdAt: daysAgo(90) })
      .returning({ id: matches.id });

    expect(await remindUnplayedMatches(test.db, now)).toBe(1);
    const bell = await test.db
      .select({ to: notifications.recipientId, type: notifications.type })
      .from(notifications)
      .where(eq(notifications.type, 'match_reminder'));
    expect(bell.map((n) => n.to).sort()).toEqual([ana, eva]);
    // Nothing new on the next sweep, nor for the pair that played.
    expect(await remindUnplayedMatches(test.db, now)).toBe(0);
    const [stopped] = await test.db
      .select({ reminders: matches.reminders })
      .from(matches)
      .where(eq(matches.id, played.id));
    expect(stopped.reminders).toBe(2);

    const later = new Date(now.getTime() + 31 * 86_400_000);
    expect(await remindUnplayedMatches(test.db, later)).toBe(1);
    const muchLater = new Date(now.getTime() + 200 * 86_400_000);
    expect(await remindUnplayedMatches(test.db, muchLater)).toBe(0);
    const [done] = await test.db
      .select({ reminders: matches.reminders })
      .from(matches)
      .where(eq(matches.id, unplayed.id));
    expect(done.reminders).toBe(2);
  });

  it('counts the community map without naming anyone', async () => {
    expect(await matchGraphStats(test.db, now)).toEqual({
      // Ana, Bia, Dora and Eva have cards on; Caio does not.
      people: 4,
      matches: 2,
      playedAfter: 1,
      alone: 1,
      groups: 1,
      largest: 3,
    });
  });
});
