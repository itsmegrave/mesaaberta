import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  gameTables,
  gmScores,
  profiles,
  systems,
  userBadges,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../../apps/web/src/lib/server/db/test-db';
import { readGmDirectoryFilters } from '../../gms/directory-filters';
import { monthStart } from '../../ratings/gm-score';
import { gmDirectorySystems, listGmDirectory } from './directory';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000052${String(n).padStart(2, '0')}`;
const now = new Date('2026-10-26T12:00:00Z');
const future = new Date('2026-11-10T20:00:00Z');
const filters = (query = '') => readGmDirectoryFilters(new URLSearchParams(query));
const list = (query = '', options: { showBadges?: boolean } = {}) =>
  listGmDirectory(test.db, filters(query), now, options);
const usernames = async (query = '') => (await list(query))!.people.map((gm) => gm.username);

let tableCount = 0;
const table = (
  system: string,
  gm: number,
  startsAt: Date,
  values: Partial<typeof gameTables.$inferInsert> = {},
) => ({
  slug: `gm-${++tableCount}`,
  title: `Mesa ${tableCount}`,
  kind: 'one_shot' as const,
  capacity: 4,
  startsAt,
  durationMinutes: 180,
  timezone: 'America/Sao_Paulo',
  gmId: id(gm),
  systemId: system,
  publishedAt: new Date('2026-08-01T12:00:00Z'),
  status: 'concluded' as const,
  ...values,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    // Ana runs a lot, has a score and a table open now.
    { id: id(1), username: 'ana', name: 'Ana Lúcia', showName: true, tableRole: 'gm', bio: 'Oi' },
    // Bia plays and runs, newer to it.
    { id: id(2), username: 'bia', name: 'Segredo', tableRole: 'both' },
    // Caio said he runs games but never published one.
    { id: id(3), username: 'caio', tableRole: 'gm' },
    // Never listed: a player, no answer, a banned account, no username.
    { id: id(4), username: 'davi', tableRole: 'player' },
    { id: id(5), username: 'eva' },
    { id: id(6), username: 'fabi', tableRole: 'gm', status: 'suspended' },
    { id: id(7), username: null, tableRole: 'gm' },
  ]);
  const [cthulhu, vampiro, dnd, tormenta] = await test.db
    .insert(systems)
    .values([
      { name: 'Call of Cthulhu GM', slug: 'cthulhu-gm' },
      { name: 'Vampiro GM', slug: 'vampiro-gm' },
      { name: 'D&D GM', slug: 'dnd-gm' },
      { name: 'Tormenta GM', slug: 'tormenta-gm' },
    ])
    .returning({ id: systems.id });
  await test.db.insert(gameTables).values([
    table(cthulhu.id, 1, new Date('2026-10-01T20:00:00Z')),
    table(cthulhu.id, 1, new Date('2026-09-01T20:00:00Z'), {
      modality: 'in_person',
      locationArea: 'Boa Viagem, Recife',
      locationCity: 'Recife',
    }),
    table(vampiro.id, 1, new Date('2026-08-01T20:00:00Z')),
    table(dnd.id, 1, new Date('2026-07-01T20:00:00Z')),
    table(tormenta.id, 1, future, { status: 'active' }),
    // Bia ran one table, the most recent of all, online.
    table(vampiro.id, 2, new Date('2026-10-20T20:00:00Z')),
    // Never counted: a draft and a table taken down.
    table(dnd.id, 3, new Date('2026-10-02T20:00:00Z'), { status: 'draft', publishedAt: null }),
    table(dnd.id, 2, new Date('2026-10-03T20:00:00Z'), { status: 'disabled' }),
  ]);
  await test.db.insert(gmScores).values([
    { gmId: id(1), score: 4.8, count: 12, month: monthStart(now).key },
    { gmId: id(2), score: 5, count: 2, month: monthStart(now).key },
  ]);
  await test.db.insert(userBadges).values([
    { profileId: id(1), badgeId: 'first-table' },
    { profileId: id(1), badgeId: 'hidden-one', hidden: true },
  ]);
});
afterAll(() => test.close());

describe('listGmDirectory', () => {
  it('lists people who said they run games, most recent table first, and nobody else', async () => {
    expect(await usernames()).toEqual(['bia', 'ana', 'caio']);
  });

  it('reads each card from public tables only', async () => {
    const people = (await list('', { showBadges: true }))!.people;
    const ana = people.find((gm) => gm.username === 'ana')!;
    expect(ana).toMatchObject({
      name: 'Ana Lúcia',
      bio: 'Oi',
      tableRole: 'gm',
      tables: 5,
      lastRunAt: new Date('2026-10-01T20:00:00Z'),
      openTables: 1,
      moreSystems: 1,
      modalities: ['in_person', 'online'],
      city: 'Recife',
    });
    expect(ana.systems).toEqual([
      { name: 'Call of Cthulhu GM', slug: 'cthulhu-gm', tables: 2 },
      expect.objectContaining({ tables: 1 }),
      expect.objectContaining({ tables: 1 }),
    ]);
    expect(ana.rating).toMatchObject({ isNew: false, count: 12 });
    expect(ana.badges!.map((badge) => badge.badgeId)).toEqual(['first-table']);

    const bia = people.find((gm) => gm.username === 'bia')!;
    // Her name is not public, and the table taken down does not count.
    expect(bia).toMatchObject({ name: null, tables: 1, openTables: 0, city: null });
    expect(bia.rating).toMatchObject({ isNew: true, count: 2 });

    const caio = people.find((gm) => gm.username === 'caio')!;
    expect(caio).toMatchObject({ tables: 0, lastRunAt: null, systems: [], modalities: [] });
    expect((await list())!.people[0].badges).toBeNull();
  });

  it('filters by system, modality, a table open now and a name typed any way', async () => {
    expect(await usernames('system=vampiro-gm')).toEqual(['bia', 'ana']);
    expect(await usernames('system=dnd-gm')).toEqual(['ana']);
    expect(await usernames('system=nao-existe')).toEqual([]);
    expect(await usernames('modality=in_person')).toEqual(['ana']);
    expect(await usernames('open=1')).toEqual(['ana']);
    expect(await usernames('q=LUCIA')).toEqual(['ana']);
    expect(await usernames('q=@bi')).toEqual(['bia']);
    // A name nobody chose to show is not searched.
    expect(await usernames('q=segredo')).toEqual([]);
  });

  it('orders by score (no score last), tables run, or name', async () => {
    expect(await usernames('sort=score')).toEqual(['ana', 'bia', 'caio']);
    expect(await usernames('sort=tables')).toEqual(['ana', 'bia', 'caio']);
    expect(await usernames('sort=name')).toEqual(['ana', 'bia', 'caio']);
  });

  it('answers null past the last page, and one empty page when nobody matches', async () => {
    expect(await list('page=2')).toBeNull();
    expect(await list('q=ninguem')).toEqual({ total: 0, pages: 1, people: [], place: null });
  });
});

describe('gmDirectorySystems', () => {
  it('offers the systems someone listed ran, most people first', async () => {
    expect((await gmDirectorySystems(test.db)).map((system) => system.slug)).toEqual([
      'vampiro-gm',
      'cthulhu-gm',
      'dnd-gm',
      'tormenta-gm',
    ]);
  });
});
