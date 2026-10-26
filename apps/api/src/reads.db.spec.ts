import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  gameTables,
  platforms,
  profiles,
  registrations,
  systems,
  tags,
} from '@mesaaberta/db/schema';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
import { readTables } from '@mesaaberta/core/server/reads/tables';
import { readDashboard } from '@mesaaberta/core/server/reads/dashboard';
import { readManage } from '@mesaaberta/core/server/reads/manage';
import { readDetail } from '@mesaaberta/core/server/reads/detail';
import { readPreview } from '@mesaaberta/core/server/reads/preview';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { readRoutes } from './reads';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000ea1';
const bia = '00000000-0000-4000-8000-000000000ea2';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana', role: 'member' },
    { id: bia, username: 'bia', role: 'member' },
  ]);
  await test.db.insert(systems).values([
    { name: 'Approved Sys', slug: 'approved-sys', status: 'approved', position: 1 },
    { name: 'Ana Pending', slug: 'ana-pending', status: 'pending', suggestedBy: ana },
    { name: 'Bia Pending', slug: 'bia-pending', status: 'pending', suggestedBy: bia },
  ] as never);
  const [pendingSystem] = await test.db
    .select({ id: systems.id })
    .from(systems)
    .where(eq(systems.slug, 'ana-pending'));
  await test.db.insert(gameTables).values({
    slug: 'mesa-ana',
    title: 'Mesa da Ana',
    kind: 'one_shot',
    capacity: 4,
    status: 'draft',
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: ana,
    systemId: pendingSystem.id,
  });
  await test.db
    .insert(platforms)
    .values([
      { name: 'Approved Plat', slug: 'approved-plat', status: 'approved', position: 1 },
    ] as never);
  await test.db
    .insert(tags)
    .values([{ name: 'Bia Tag', slug: 'bia-tag', status: 'pending', suggestedBy: bia }] as never);
});
afterAll(() => test.close());

const app = readRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (actor?: string) =>
  app.request('/catalog', { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);

describe('GET /v1/reads/catalog', () => {
  it('answers exactly what the in-process reader builds for the same person', async () => {
    for (const actor of [ana, bia]) {
      const answer = await get(actor);
      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual(
        JSON.parse(JSON.stringify(await readCatalog(test.db, actor))),
      );
    }
  });

  it("shows a person their own pending suggestions and not someone else's", async () => {
    const body = (await (await get(ana)).json()) as {
      systems: { slug: string }[];
      catalog: { tags: { slug: string }[] };
    };

    const slugs = body.systems.map((s) => s.slug);
    expect(slugs).toContain('approved-sys');
    expect(slugs).toContain('ana-pending');
    expect(slugs).not.toContain('bia-pending');
    expect(body.catalog.tags.map((t) => t.slug)).not.toContain('bia-tag');
  });

  it('needs a known actor', async () => {
    expect((await get()).status).toBe(401);
    expect((await get('00000000-0000-4000-8000-0000000fffff')).status).toBe(403);
  });
});

const getEdit = (slug: string, actor?: string, tz = 'America/Sao_Paulo') =>
  app.request(
    `/edit-catalog/${slug}?tz=${tz}`,
    { headers: actor ? { [ACTOR_HEADER]: actor } : {} },
    env,
  );

describe('GET /v1/reads/edit-catalog/:slug', () => {
  it("answers exactly what the in-process reader builds, with the table's own pending system", async () => {
    const answer = await getEdit('mesa-ana', ana);

    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { systems: { slug: string }[] };
    expect(body.systems.map((s) => s.slug)).toContain('ana-pending');
    expect(body).toEqual(
      JSON.parse(
        JSON.stringify(
          await readEditCatalog(
            test.db,
            { id: ana, role: 'member', status: 'active' },
            'mesa-ana',
            'America/Sao_Paulo',
          ),
        ),
      ),
    );
  });

  it('refuses someone who is not the GM, and an unknown table, with the codes web turns back', async () => {
    expect((await getEdit('mesa-ana', bia)).status).toBe(403);
    expect(await (await getEdit('mesa-ana', bia)).json()).toEqual({ error: 'forbidden' });
    expect((await getEdit('nao-existe', ana)).status).toBe(404);
    expect((await getEdit('mesa-ana')).status).toBe(401);
  });
});

describe('GET /v1/reads/preview', () => {
  it('answers exactly what the in-process reader builds, without the GM id', async () => {
    const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
    await test.db.insert(gameTables).values({
      slug: 'mesa-publica',
      title: 'Mesa pública',
      kind: 'one_shot',
      capacity: 4,
      status: 'active',
      startsAt: new Date('2099-02-01T20:00:00Z'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: ana,
      systemId: system.id,
      publishedAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    const answer = await app.request('/preview', { headers: { [ACTOR_HEADER]: ana } }, env);

    expect(answer.status).toBe(200);
    const body = (await answer.json()) as {
      tables: { slug: string }[];
      newTables: { slug: string }[];
    };
    expect(body.tables.map((t) => t.slug)).toContain('mesa-publica');
    expect(body.newTables.map((t) => t.slug)).toContain('mesa-publica');
    expect(JSON.stringify(body)).not.toContain('gmId');
    expect(body).toEqual(JSON.parse(JSON.stringify(await readPreview(test.db, new Date()))));
  });

  it('needs a known actor', async () => {
    expect((await app.request('/preview', {}, env)).status).toBe(401);
  });
});

describe('GET /v1/reads/tables', () => {
  const getTables = (query = '', actor: string | null = ana) =>
    app.request(`/tables${query}`, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);

  it('answers what the in-process reader builds for the same filters, and drops junk', async () => {
    const filters = { systems: [], modality: null, platforms: [], tags: [], gm: null };

    const all = await getTables('?bogus=1&system=NOT%20A%20SLUG');
    expect(all.status).toBe(200);
    expect(await all.json()).toEqual(
      JSON.parse(JSON.stringify(await readTables(test.db, filters, new Date()))),
    );

    const none = (await (await getTables('?system=no-such-system')).json()) as {
      tables: unknown[];
      pickedSystems: string[];
    };
    expect(none.tables).toEqual([]);
    expect(none.pickedSystems).toEqual(['no-such-system']);
  });

  it('needs a known actor', async () => {
    expect((await getTables('', null)).status).toBe(401);
  });
});

describe('GET /v1/reads/detail/:slug', () => {
  const getDetail = (slug: string, actor: string | null = ana) =>
    app.request(`/detail/${slug}`, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);
  const actorOf = async (id: string) =>
    (
      await test.db
        .select({ id: profiles.id, role: profiles.role, status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, id))
    )[0];

  it('answers exactly what the in-process reader builds, per viewer', async () => {
    const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
    const [table] = await test.db
      .insert(gameTables)
      .values({
        slug: 'mesa-detalhe',
        title: 'Mesa de detalhe',
        kind: 'one_shot',
        capacity: 4,
        status: 'active',
        startsAt: new Date('2099-03-01T20:00:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        gmId: ana,
        systemId: system.id,
        joinDetails: 'https://example.test/sala',
      } as never)
      .returning({ id: gameTables.id });
    await test.db
      .insert(registrations)
      .values({ tableId: table.id, playerId: bia, status: 'confirmed' } as never);

    for (const who of [ana, bia]) {
      const answer = await getDetail('mesa-detalhe', who);
      expect(answer.status).toBe(200);
      const body = await answer.json();
      expect(JSON.stringify(body)).not.toContain('gmId');
      expect(body).toEqual(
        JSON.parse(
          JSON.stringify(await readDetail(test.db, await actorOf(who), 'mesa-detalhe', new Date())),
        ),
      );
    }
    // The GM sees the private parts; a confirmed player the join details only.
    expect(
      ((await (await getDetail('mesa-detalhe', ana)).json()) as { registrations: unknown })
        .registrations,
    ).not.toBeNull();
    expect(
      ((await (await getDetail('mesa-detalhe', bia)).json()) as { registrations: unknown })
        .registrations,
    ).toBeNull();
  });

  it('keeps someone else’s draft and unknown tables a 404', async () => {
    expect((await getDetail('mesa-ana', bia)).status).toBe(404);
    expect((await getDetail('mesa-ana', ana)).status).toBe(200);
    expect((await getDetail('no-such-table')).status).toBe(404);
  });

  it('needs a known actor', async () => {
    expect((await getDetail('mesa-detalhe', null)).status).toBe(401);
  });
});

describe('GET /v1/reads/dashboard', () => {
  const getDashboard = (query = '', actor: string | null = ana) =>
    app.request(`/dashboard${query}`, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);

  it('answers exactly what the in-process reader builds, for what each person runs and plays', async () => {
    // Needs the table the detail specs seed: Ana runs it, Bia has a confirmed seat.
    for (const who of [ana, bia]) {
      const answer = await getDashboard('', who);
      expect(answer.status).toBe(200);
      expect(await answer.json()).toEqual(
        JSON.parse(JSON.stringify(await readDashboard(test.db, who, null, new Date()))),
      );
    }
    const mine = (await (await getDashboard('', ana)).json()) as { totals: { running: number } };
    const hers = (await (await getDashboard('', bia)).json()) as { totals: { playing: number } };
    expect(mine.totals.running).toBeGreaterThan(0);
    expect(hers.totals.playing).toBeGreaterThan(0);
  });

  it('reads junk as page 1 and answers a 404 past the last page', async () => {
    expect(((await (await getDashboard('?page=abc')).json()) as { page: number }).page).toBe(1);
    expect((await getDashboard('?page=99')).status).toBe(404);
  });

  it('needs a known actor', async () => {
    expect((await getDashboard('', null)).status).toBe(401);
  });
});

describe('GET /v1/reads/manage/:slug', () => {
  const getManage = (slug: string, actor: string | null = ana) =>
    app.request(`/manage/${slug}`, { headers: actor ? { [ACTOR_HEADER]: actor } : {} }, env);
  const actorOf = async (id: string) =>
    (
      await test.db
        .select({ id: profiles.id, role: profiles.role, status: profiles.status })
        .from(profiles)
        .where(eq(profiles.id, id))
    )[0];

  it('answers exactly what the in-process reader builds for the GM, without the GM id', async () => {
    const answer = await getManage('mesa-detalhe');
    expect(answer.status).toBe(200);
    const body = await answer.json();
    expect(JSON.stringify(body)).not.toContain('gmId');
    expect(body).toEqual(
      JSON.parse(
        JSON.stringify(await readManage(test.db, await actorOf(ana), 'mesa-detalhe', new Date())),
      ),
    );
  });

  it('refuses everyone but the GM, and unknown tables', async () => {
    expect((await getManage('mesa-detalhe', bia)).status).toBe(403);
    expect((await getManage('no-such-table')).status).toBe(404);
  });

  it('needs a known actor', async () => {
    expect((await getManage('mesa-detalhe', null)).status).toBe(401);
  });
});
