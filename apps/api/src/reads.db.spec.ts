import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { platforms, profiles, systems, tags } from '@mesaaberta/db/schema';
import { readCatalog } from '@mesaaberta/core/server/reads/catalog';
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
