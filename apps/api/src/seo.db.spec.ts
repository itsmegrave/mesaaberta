import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, profiles, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { seoRoutes } from './seo';
import { sitemapResponse } from '../../web/src/lib/seo/sitemap';

let test: Awaited<ReturnType<typeof createTestDb>>;
const owner = '00000000-0000-4000-8000-000000000a01';
const inactive = '00000000-0000-4000-8000-000000000a02';
const env = { DATABASE_URL: 'postgres://test' };
const edited = new Date('2026-10-20T12:00:00Z');
const app = seoRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const get = (path: string) => app.request(path, {}, env);
beforeAll(async () => {
  test = await createTestDb();
  await test.db
    .insert(profiles)
    .values([
      { id: owner, username: 'ana-player' },
      { id: inactive, username: 'inactive-player', status: 'suspended' },
      { id: '00000000-0000-4000-8000-000000000a03', username: 'tables' },
      { id: '00000000-0000-4000-8000-000000000a04' },
    ]);
  const [approved, pending] = await test.db
    .insert(systems)
    .values([
      { name: 'Approved', slug: 'approved', status: 'approved' },
      { name: 'Pending', slug: 'pending', status: 'pending', suggestedBy: owner },
    ] as never)
    .returning();
  await test.db.insert(gameTables).values(
    [
      { slug: 'public-active', status: 'active' },
      { slug: 'public-concluded', status: 'concluded' },
      { slug: 'a-draft', status: 'draft' },
      { slug: 'a-disabled', status: 'disabled' },
      { slug: 'inactive-owner', status: 'active', gmId: inactive },
      { slug: 'pending-system', status: 'active', systemId: pending.id },
      { slug: 'new', status: 'active' },
    ].map((row) => ({
      title: 'Example',
      kind: 'one_shot' as const,
      capacity: 4,
      startsAt: new Date('2099-01-01'),
      durationMinutes: 60,
      timezone: 'UTC',
      gmId: owner,
      systemId: approved.id,
      updatedAt: edited,
      joinDetails: 'PRIVATE_JOIN',
      welcomeMessage: 'PRIVATE_WELCOME',
      ...row,
    })) as never,
  );
});
afterAll(() => test.close());
describe('public sitemap reads', () => {
  it('returns only public identifiers, without an actor or private fields', async () => {
    const response = await get('/sitemap/tables');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entries: [
        { slug: 'public-active', lastmod: edited.toISOString() },
        { slug: 'public-concluded', lastmod: edited.toISOString() },
      ],
    });
    expect(await (await get('/sitemap/profiles')).json()).toEqual({
      entries: [{ slug: 'ana-player' }],
    });
    // The test database comes with the seeded catalogue, so systems fill more than one page.
    expect(await (await get('/sitemap')).json()).toEqual({ tables: 1, profiles: 1, systems: 2 });
    // Approved systems only: the directory's pages.
    const systemSlugs = [
      ...((await (await get('/sitemap/systems')).json()) as { entries: { slug: string }[] })
        .entries,
      ...((await (await get('/sitemap/systems?page=2')).json()) as { entries: { slug: string }[] })
        .entries,
    ].map((entry) => entry.slug);
    expect(systemSlugs).toContain('approved');
    expect(systemSlugs).not.toContain('pending');
  });
  it('serves XML through the required transport using the real API read', async () => {
    const locals = {
      env: {
        APP_ORIGIN: 'https://mesaaberta.example',
        API: {
          fetch: (request: Request) =>
            app.request(
              new URL(request.url).pathname.replace('/v1/seo', '') + new URL(request.url).search,
              {},
              env,
            ),
        },
      },
      host: {},
      flags: { isEnabled: async () => false },
    } as unknown as App.Locals;
    const response = await sitemapResponse(locals, 'tables', 1);
    expect(response.status).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('https://mesaaberta.example/t/public-active');
    expect(xml).toContain('<lastmod>2026-10-20T12:00:00.000Z</lastmod>');
    expect(xml).not.toContain('PRIVATE');
    expect(xml).not.toContain('a-draft');
  });
  it('lists the systems directory and its pages only while it is on for visitors', async () => {
    const flags = { isEnabled: async (_flag: string, target: object) => on && !('id' in target) };
    let on = true;
    const locals = {
      env: {
        APP_ORIGIN: 'https://mesaaberta.example',
        API: {
          fetch: (request: Request) =>
            app.request(
              new URL(request.url).pathname.replace('/v1/seo', '') + new URL(request.url).search,
              {},
              env,
            ),
        },
      },
      host: {},
      flags,
    } as unknown as App.Locals;
    const index = await (await sitemapResponse(locals, 'index', 1)).text();
    expect(index).toContain('https://mesaaberta.example/sitemap-systems.xml');
    expect(await (await sitemapResponse(locals, 'pages', 1)).text()).toContain(
      'https://mesaaberta.example/systems</loc>',
    );
    const systemsXml =
      (await (await sitemapResponse(locals, 'systems', 1)).text()) +
      (await (await sitemapResponse(locals, 'systems', 2)).text());
    expect(systemsXml).toContain('https://mesaaberta.example/s/approved');
    expect(systemsXml).not.toContain('/s/pending<');

    on = false;
    expect(await (await sitemapResponse(locals, 'index', 1)).text()).not.toContain('systems');
    expect(await (await sitemapResponse(locals, 'pages', 1)).text()).not.toContain('/systems');
    expect((await sitemapResponse(locals, 'systems', 1)).status).toBe(404);
  });

  it('rejects invalid pages and unavailable databases', async () => {
    for (const path of [
      '/sitemap/unknown',
      '/sitemap/tables?page=0',
      '/sitemap/tables?page=1x',
      '/sitemap/tables?page=999',
    ])
      expect((await get(path)).status).toBe(404);
    expect((await app.request('/sitemap', {}, {})).status).toBe(503);
  });
  it('bounds each page and includes every eligible profile exactly once', async () => {
    await test.db.insert(profiles).values(
      Array.from({ length: 501 }, (_, i) => ({
        id: `00000000-0000-4000-8001-${String(i).padStart(12, '0')}`,
        username: `person-${String(i).padStart(4, '0')}`,
      })),
    );
    const first = (await (await get('/sitemap/profiles')).json()) as {
      entries: { slug: string }[];
    };
    const second = (await (await get('/sitemap/profiles?page=2')).json()) as typeof first;
    expect(first.entries).toHaveLength(500);
    expect(second.entries).toHaveLength(2);
    expect(new Set([...first.entries, ...second.entries].map((row) => row.slug)).size).toBe(502);
    expect(await (await get('/sitemap')).json()).toEqual({ tables: 1, profiles: 2, systems: 2 });
  });
});
