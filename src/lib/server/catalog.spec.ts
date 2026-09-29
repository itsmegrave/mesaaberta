import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, systems, tags } from './db/schema';
import { createTestDb } from './db/test-db';
import { catalogOf, listCatalog, setTableCatalog } from './catalog';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000801';
const otherGm = '00000000-0000-4000-8000-000000000802';
let tableId: string;

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'catalogo' },
    { id: otherGm, username: 'outro-mestre' },
  ]);
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

    await setTableCatalog(test.db, tableId, { gmId: gm, platformSlugs: ['roll20'], tagSlugs: [] });
    const second = (await catalogOf(test.db, [tableId])).get(tableId)!;
    expect(second).toEqual({ platforms: [{ name: 'Roll20', slug: 'roll20' }], tags: [] });
  });

  it('refuses a slug the catalog does not have or has not approved', async () => {
    await expect(
      setTableCatalog(test.db, tableId, { gmId: gm, platformSlugs: ['orkut'], tagSlugs: [] }),
    ).rejects.toMatchObject({ field: 'platforms' });
    await expect(
      setTableCatalog(test.db, tableId, { gmId: gm, platformSlugs: [], tagSlugs: ['pendente'] }),
    ).rejects.toMatchObject({ field: 'tags' });
  });

  it('gives an empty catalog for a table without picks', async () => {
    await setTableCatalog(test.db, tableId, { gmId: gm, platformSlugs: [], tagSlugs: [] });
    expect((await catalogOf(test.db, [tableId])).get(tableId)).toEqual({
      platforms: [],
      tags: [],
    });
    void eq;
  });
});

describe('suggestions', () => {
  const tagRow = async (slug: string) =>
    (await test.db.select().from(tags).where(eq(tags.slug, slug)))[0];

  it('saves a new term as a pending suggestion by the GM, and links it to the table', async () => {
    await setTableCatalog(test.db, tableId, {
      gmId: gm,
      platformSlugs: [],
      tagSlugs: ['terror', 'new:Mesa de Bar'],
    });

    expect(await tagRow('mesa-de-bar')).toMatchObject({
      name: 'Mesa de Bar',
      status: 'pending',
      suggestedBy: gm,
    });
    const withPending = (await catalogOf(test.db, [tableId], { withPending: true })).get(tableId)!;
    expect(withPending.tags).toEqual([
      { name: 'Terror', slug: 'terror' },
      { name: 'Mesa de Bar', slug: 'mesa-de-bar', pending: true },
    ]);
  });

  it('keeps a pending suggestion off the public view of the table', async () => {
    const shown = (await catalogOf(test.db, [tableId])).get(tableId)!;
    expect(shown.tags.map((t) => t.slug)).toEqual(['terror']);
  });

  it("offers the GM their own pending suggestions, and nobody else's", async () => {
    const own = await listCatalog(test.db, { suggestedBy: gm });
    expect(own.tags).toContainEqual({ name: 'Mesa de Bar', slug: 'mesa-de-bar', pending: true });

    const other = await listCatalog(test.db, { suggestedBy: otherGm });
    expect(other.tags.map((t) => t.slug)).not.toContain('mesa-de-bar');
  });

  it('keeps a pending pick already on the table when the table is saved again by slug', async () => {
    await setTableCatalog(test.db, tableId, {
      gmId: gm,
      platformSlugs: [],
      tagSlugs: ['mesa-de-bar'],
    });
    const saved = (await catalogOf(test.db, [tableId], { withPending: true })).get(tableId)!;
    expect(saved.tags.map((t) => t.slug)).toEqual(['mesa-de-bar']);
  });

  it('uses the catalog entry when the new term is one it already has', async () => {
    await setTableCatalog(test.db, tableId, {
      gmId: gm,
      platformSlugs: ['new:discord'],
      tagSlugs: [],
    });
    const saved = (await catalogOf(test.db, [tableId])).get(tableId)!;
    expect(saved.platforms).toEqual([{ name: 'Discord', slug: 'discord' }]);
  });

  it("joins another GM's pending suggestion of the same term instead of making a second one", async () => {
    await setTableCatalog(test.db, tableId, {
      gmId: otherGm,
      platformSlugs: [],
      tagSlugs: ['new:MESA DE BAR'],
    });
    const rows = await test.db.select().from(tags).where(eq(tags.slug, 'mesa-de-bar'));
    expect(rows).toHaveLength(1);
    expect(rows[0].suggestedBy).toBe(gm);
  });

  it("refuses another GM's pending entry picked by slug, which only its author can see", async () => {
    await test.db
      .insert(tags)
      .values({ name: 'Segredo', slug: 'segredo', status: 'pending', suggestedBy: otherGm });
    await expect(
      setTableCatalog(test.db, tableId, { gmId: gm, platformSlugs: [], tagSlugs: ['segredo'] }),
    ).rejects.toMatchObject({ field: 'tags', message: 'invalid' });
  });

  it('refuses a term the moderation turned down', async () => {
    await test.db.insert(tags).values({ name: 'Proibida', slug: 'proibida', status: 'rejected' });
    await expect(
      setTableCatalog(test.db, tableId, {
        gmId: gm,
        platformSlugs: [],
        tagSlugs: ['new:Proibida'],
      }),
    ).rejects.toMatchObject({ field: 'tags', message: 'suggestion_unavailable' });
  });

  it('refuses a new term that is too short or too long', async () => {
    for (const name of ['a', 'x'.repeat(41)]) {
      await expect(
        setTableCatalog(test.db, tableId, {
          gmId: gm,
          platformSlugs: [`new:${name}`],
          tagSlugs: [],
        }),
      ).rejects.toMatchObject({ field: 'platforms', message: 'suggestion_invalid' });
    }
  });
});
