import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, platforms, profiles, systems, tags } from '@mesaaberta/db/schema';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
import { readEditCatalog } from '@mesaaberta/core/server/reads/edit-catalog';
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
    });
    const answer = await app.request('/preview', { headers: { [ACTOR_HEADER]: ana } }, env);

    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { tables: { slug: string }[] };
    expect(body.tables.map((t) => t.slug)).toContain('mesa-publica');
    expect(JSON.stringify(body)).not.toContain('gmId');
    expect(body).toEqual(JSON.parse(JSON.stringify(await readPreview(test.db, new Date()))));
  });

  it('needs a known actor', async () => {
    expect((await app.request('/preview', {}, env)).status).toBe(401);
  });
});
