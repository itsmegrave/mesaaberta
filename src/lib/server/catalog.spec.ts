import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, systems, tags } from './db/schema';
import { createTestDb } from './db/test-db';
import { catalogOf, listCatalog, setTableCatalog } from './catalog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000801';
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values({ id: gm, username: 'catalogo' });
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  const [table] = await test.db
    .insert(gameTables)
    .values({
      slug: 'catalogo',
      title: 'Catálogo',
      kind: 'one_shot',
      capacity: 4,
      startsAt: new Date('2026-10-20T22:00:00Z'),
      durationMinutes: 120,
      timezone: 'UTC',
      gmId: gm,
      systemId: system.id,
    })
    .returning({ id: gameTables.id });
  tableId = table.id;
});
afterAll(() => test.close());

describe('listCatalog', () => {
  it('offers the seeded, approved platforms and tags in catalog order', async () => {
    const { platforms, tags } = await listCatalog(test.db);

    expect(platforms[0]).toEqual({ name: 'Discord', slug: 'discord' });
    expect(platforms.map((p) => p.slug)).toContain('foundry-vtt');
    expect(platforms).toContainEqual({ name: 'Old Dragon Online', slug: 'old-dragon-online' });
    expect(platforms).toContainEqual({ name: 'Outro', slug: 'outro' });
    expect(tags[0]).toEqual({ name: 'Iniciantes', slug: 'iniciantes' });
  });

  it('leaves out entries that are not approved', async () => {
    await test.db.insert(tags).values({ name: 'Pendente', slug: 'pendente', status: 'pending' });

    expect((await listCatalog(test.db)).tags.map((t) => t.slug)).not.toContain('pendente');
  });
});

describe('setTableCatalog and catalogOf', () => {
  it("stores a table's picks in the order picked, and a later save replaces them", async () => {
    await setTableCatalog(test.db, tableId, {
      platformSlugs: ['foundry-vtt', 'discord', 'old-dragon-online', 'outro'],
      tagSlugs: ['terror', 'iniciantes'],
    });

    const first = (await catalogOf(test.db, [tableId])).get(tableId)!;
    expect(first.platforms.map((p) => p.name)).toEqual([
      'Foundry VTT',
      'Discord',
      'Old Dragon Online',
      'Outro',
    ]);
    expect(first.tags.map((t) => t.name)).toEqual(['Terror', 'Iniciantes']);

    await setTableCatalog(test.db, tableId, { platformSlugs: ['roll20'], tagSlugs: [] });
    const second = (await catalogOf(test.db, [tableId])).get(tableId)!;
    expect(second).toEqual({ platforms: [{ name: 'Roll20', slug: 'roll20' }], tags: [] });
  });

  it('refuses a slug the catalog does not have or has not approved', async () => {
    await expect(
      setTableCatalog(test.db, tableId, { platformSlugs: ['orkut'], tagSlugs: [] }),
    ).rejects.toMatchObject({ field: 'platforms' });
    await expect(
      setTableCatalog(test.db, tableId, { platformSlugs: [], tagSlugs: ['pendente'] }),
    ).rejects.toMatchObject({ field: 'tags' });
  });

  it('gives an empty catalog for a table without picks', async () => {
    await setTableCatalog(test.db, tableId, { platformSlugs: [], tagSlugs: [] });
    expect((await catalogOf(test.db, [tableId])).get(tableId)).toEqual({
      platforms: [],
      tags: [],
    });
    void eq;
  });
});
