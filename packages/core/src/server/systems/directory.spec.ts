import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, profiles, systems } from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../../apps/web/src/lib/server/db/test-db';
import { readSystemDirectoryFilters } from '../../systems/directory-filters';
import { listSystemDirectory, readSystemPage } from './directory';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000051${String(n).padStart(2, '0')}`;
const now = new Date('2026-10-26T12:00:00Z');
const future = new Date('2026-11-10T20:00:00Z');
const past = new Date('2026-09-10T20:00:00Z');
const filters = (query = '') => readSystemDirectoryFilters(new URLSearchParams(query));

let tableCount = 0;
const table = (
  system: string,
  gm: number,
  values: Partial<typeof gameTables.$inferInsert> = {},
) => ({
  slug: `mesa-${++tableCount}`,
  title: `Mesa ${tableCount}`,
  kind: 'one_shot' as const,
  capacity: 4,
  startsAt: future,
  durationMinutes: 180,
  timezone: 'America/Sao_Paulo',
  gmId: id(gm),
  systemId: system,
  publishedAt: past,
  ...values,
});

beforeAll(async () => {
  test = await createTestDb();
  // The migrations seed the real catalog; these tests count their own systems only.
  await test.db.delete(systems);
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bia' },
    { id: id(3), username: 'banida', status: 'suspended' },
  ]);
  const [cthulhu, vampiro, novo, rascunho, antigo] = await test.db
    .insert(systems)
    .values([
      { name: 'Call of Cthulhu', slug: 'call-of-cthulhu', position: 2 },
      { name: 'Vampiro: A Máscara', slug: 'vampiro-a-mascara', position: 1 },
      { name: 'Mythic Bastionland', slug: 'mythic-bastionland', position: 3 },
      { name: 'Sugestão', slug: 'sugestao', status: 'pending' },
      { name: 'Cthulhu Antigo', slug: 'cthulhu-antigo', status: 'rejected' },
    ])
    .returning({ id: systems.id });
  await test.db.update(systems).set({ mergedInto: cthulhu.id }).where(eq(systems.id, antigo.id));
  void novo;
  await test.db.insert(gameTables).values([
    // Call of Cthulhu: two open tables, one ended, one by a banned GM, plus what never counts.
    table(cthulhu.id, 1),
    table(cthulhu.id, 2, { modality: 'in_person', locationArea: 'Boa Viagem, Recife' }),
    table(cthulhu.id, 1, { status: 'concluded', startsAt: past }),
    table(cthulhu.id, 3, { status: 'concluded', startsAt: past }),
    table(cthulhu.id, 1, { status: 'draft', publishedAt: null }),
    table(cthulhu.id, 2, { status: 'disabled', moderatedAt: past }),
    // Vampiro: played once, nothing open now.
    table(vampiro.id, 2, { status: 'concluded', startsAt: past }),
    table(rascunho.id, 1, { status: 'draft', publishedAt: null }),
  ]);
});
afterAll(() => test.close());

describe('listSystemDirectory', () => {
  it('lists only systems with an open table by default, with their counts and GMs', async () => {
    const list = await listSystemDirectory(test.db, filters(), now);
    expect(list).toMatchObject({ total: 1, pages: 1 });
    expect(list!.systems).toEqual([
      {
        name: 'Call of Cthulhu',
        slug: 'call-of-cthulhu',
        openTables: 2,
        // Drafts and moderated tables never count; the banned GM's table does, the GM does not.
        totalTables: 4,
        gmCount: 2,
        gms: [
          { username: 'ana', avatarPath: null, avatarUrl: null },
          { username: 'bia', avatarPath: null, avatarUrl: null },
        ],
      },
    ]);
  });

  it('shows every approved system under "Todos", never a suggestion or a rejected one', async () => {
    const list = await listSystemDirectory(test.db, filters('show=all&sort=az'), now);
    expect(list!.systems.map((system) => system.slug)).toEqual([
      'call-of-cthulhu',
      'mythic-bastionland',
      'vampiro-a-mascara',
    ]);
    expect(list!.systems[1]).toMatchObject({ openTables: 0, totalTables: 0, gmCount: 0, gms: [] });
  });

  it('orders by tables played, then the catalog position', async () => {
    const list = await listSystemDirectory(test.db, filters('show=all&sort=played'), now);
    expect(list!.systems.map((system) => system.slug)).toEqual([
      'call-of-cthulhu',
      'vampiro-a-mascara',
      'mythic-bastionland',
    ]);
  });

  it('searches without minding accents or case', async () => {
    const accents = await listSystemDirectory(test.db, filters('show=all&q=MASCARA'), now);
    expect(accents!.systems.map((system) => system.slug)).toEqual(['vampiro-a-mascara']);
    const typed = await listSystemDirectory(test.db, filters('show=all&q=máscara'), now);
    expect(typed!.total).toBe(1);
    const literal = await listSystemDirectory(test.db, filters('show=all&q=%25'), now);
    expect(literal!.total).toBe(0);
  });

  it('answers null for a page past the last, and page 1 for an empty list', async () => {
    expect(await listSystemDirectory(test.db, filters('page=2'), now)).toBeNull();
    expect(await listSystemDirectory(test.db, filters('q=nada-disso'), now)).toMatchObject({
      total: 0,
      pages: 1,
      systems: [],
    });
  });
});

describe('readSystemPage', () => {
  it('reads the counts, modalities, open tables, the people who run it and ended tables', async () => {
    const page = await readSystemPage(test.db, 'call-of-cthulhu', now);
    expect(page).not.toBeNull();
    if (!page || 'redirectTo' in page) return;
    expect(page.facts).toEqual({ openTables: 2, totalTables: 4, gmCount: 2 });
    expect(page.modalities).toEqual(['in_person', 'online']);
    expect(page.openTables).toHaveLength(2);
    expect(page.openTables[0]).not.toHaveProperty('gmId');
    // Ana has two tables of it, Bia one; the banned account is left out.
    expect(page.gms.map((gm) => [gm.username, gm.tables])).toEqual([
      ['ana', 2],
      ['bia', 1],
    ]);
    expect(page.ended.map((ended) => ended.gmName).sort()).toEqual(['ana', 'banida']);
  });

  it('is not found for a suggestion or an unknown slug, and moves a merged one', async () => {
    expect(await readSystemPage(test.db, 'sugestao', now)).toBeNull();
    expect(await readSystemPage(test.db, 'nao-existe', now)).toBeNull();
    expect(await readSystemPage(test.db, 'cthulhu-antigo', now)).toEqual({
      redirectTo: 'call-of-cthulhu',
    });
  });
});
