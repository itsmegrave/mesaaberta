import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, registrations, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { yearReviewRoutes } from './year-review';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000f31';
const gm = '00000000-0000-4000-8000-000000000f32';
const bia = '00000000-0000-4000-8000-000000000f33';
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
    { id: gm, username: 'mestre', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
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
      // Ana plays two of the GM's tables in March, with Bia at one.
      {
        ...table,
        slug: 'r1',
        gmId: gm,
        status: 'concluded',
        startsAt: new Date('2026-03-05T22:00:00Z'),
      },
      {
        ...table,
        slug: 'r2',
        gmId: gm,
        status: 'concluded',
        startsAt: new Date('2026-03-20T22:00:00Z'),
      },
      // Ana runs one in May, Bia plays it.
      {
        ...table,
        slug: 'r3',
        gmId: ana,
        status: 'concluded',
        startsAt: new Date('2026-05-02T22:00:00Z'),
      },
      // Not counted: last year, and one not concluded.
      {
        ...table,
        slug: 'r4',
        gmId: gm,
        status: 'concluded',
        startsAt: new Date('2025-12-31T23:00:00Z'),
      },
      {
        ...table,
        slug: 'r5',
        gmId: gm,
        status: 'not_held',
        startsAt: new Date('2026-06-01T22:00:00Z'),
      },
    ] as never)
    .returning({ id: gameTables.id, slug: gameTables.slug });
  const id = (slug: string) => tables.find((row) => row.slug === slug)!.id;
  await test.db.insert(registrations).values([
    { tableId: id('r1'), playerId: ana, status: 'confirmed' },
    { tableId: id('r1'), playerId: bia, status: 'confirmed' },
    { tableId: id('r2'), playerId: ana, status: 'confirmed' },
    { tableId: id('r3'), playerId: bia, status: 'confirmed' },
    { tableId: id('r4'), playerId: ana, status: 'confirmed' },
    { tableId: id('r5'), playerId: ana, status: 'confirmed' },
  ] as never);
});
afterAll(() => test.close());

const app = () => yearReviewRoutes((() => ({ db: test.db, close: async () => {} })) as never);
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

describe('api Retrospectiva routes over a database', () => {
  it("counts the person's concluded tables of the year", async () => {
    const answer = await call('/ana/2026', ana);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({
      own: true,
      shared: false,
      person: { username: 'ana' },
      review: {
        year: 2026,
        played: 2,
        ran: 1,
        systems: [{ slug: system.slug, tables: 3 }],
        // The GM and Bia.
        companions: 2,
        topGm: { username: 'mestre', tables: 2 },
        busiestMonth: 3,
        badges: 0,
      },
    });
  });

  it('is private until the person makes it public, and a year with none is a 404', async () => {
    expect((await call('/ana/2026', bia)).status).toBe(404);
    expect((await call('/ana/2026', null)).status).toBe(404);
    expect((await call('/ana/2019', ana)).status).toBe(404);
    expect((await call('/ana/2099', ana)).status).toBe(404);
    expect((await call('/ninguem/2026', ana)).status).toBe(404);

    const shared = await call('/share', ana, { shared: true });
    expect((await shared.json()).eventIds).toHaveLength(1);
    const seen = await call('/ana/2026', null);
    expect(seen.status).toBe(200);
    expect(await seen.json()).toMatchObject({ own: false, shared: true });

    await call('/share', ana, { shared: false });
    expect((await call('/ana/2026', bia)).status).toBe(404);
  });

  it('needs a signed-in person to share', async () => {
    expect((await call('/share', null, { shared: true })).status).toBe(401);
  });
});
