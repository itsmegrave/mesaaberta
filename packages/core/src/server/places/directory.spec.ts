import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  gameTables,
  placeLinks,
  places,
  profiles,
  systems,
} from '@mesaaberta/core/server/db/schema';
import { createTestDb } from '../../../../../apps/web/src/lib/server/db/test-db';
import { readPlaceFilters } from '../../places/filters';
import { listPlaces, readPlacePage } from './directory';
import { setPlaceFeatures } from './features';
import { rebuildPlaceTags } from './tags';

let test: Awaited<ReturnType<typeof createTestDb>>;
const id = (n: number) => `00000000-0000-4000-8000-0000000068${String(n).padStart(2, '0')}`;
const now = new Date('2026-10-26T12:00:00Z');
const approved = new Date('2026-10-01T12:00:00Z');
const list = (query = '') => listPlaces(test.db, readPlaceFilters(new URLSearchParams(query)), now);
const slugs = async (query = '') => (await list(query))!.places.map((place) => place.slug);

type Place = typeof places.$inferInsert;
const place = (n: number, values: Partial<Place>): Place => ({
  id: id(50 + n),
  slug: `lugar-${n}`,
  submitterId: id(1),
  name: `Lugar ${n}`,
  kind: 'store',
  postalCode: '51020000',
  street: 'Rua 1',
  neighbourhood: 'Boa Viagem',
  city: 'Recife',
  state: 'PE',
  approvedAt: approved,
  ...values,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: id(1), username: 'ana' },
    { id: id(2), username: 'bia' },
    { id: id(3), username: 'caio' },
  ]);
  const rows = [
    place(1, {
      name: 'Taverna do Dado',
      kind: 'game_cafe',
      amenities: ['free_to_play', 'accessible'],
    }),
    place(2, {
      name: 'Clube Ágora',
      kind: 'club',
      neighbourhood: null,
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01310100',
      approvedAt: new Date('2026-10-20T12:00:00Z'),
    }),
    place(3, {
      name: 'Bar da Rolagem',
      kind: 'bar',
      amenities: ['free_to_play'],
      ownerId: id(2),
      ownerSince: approved,
    }),
    // Never listed: waiting for review, hidden for reports, removed.
    place(4, { name: 'Esperando', approvedAt: null }),
    place(5, { name: 'Escondido', hiddenAt: now, hiddenReason: 'reports' }),
    place(6, { name: 'Fechado', removedAt: now, removalReason: 'place_closed' }),
  ];
  await test.db.insert(places).values(rows);
  // Their tags: catalog entries, and on the first one a suggestion of its submitter's that waits.
  const picks: Record<string, string[]> = {
    [id(51)]: ['free-to-play', 'accessible', 'rpg', 'new:Bar de vinil'],
    [id(53)]: ['free-to-play'],
  };
  for (const row of rows.slice(0, 3)) {
    await setPlaceFeatures(test.db, row.id!, id(1), picks[row.id!] ?? []);
    await rebuildPlaceTags(test.db, row.id!, {
      state: row.state,
      city: row.city,
      neighbourhood: row.neighbourhood ?? null,
      kind: row.kind,
    });
  }
  await test.db.insert(placeLinks).values({
    placeId: id(51),
    network: 'instagram',
    url: 'https://instagram.com/taverna',
    position: 0,
  });
  const [system] = await test.db
    .insert(systems)
    .values({ name: 'Sistema Lugar', slug: 'sistema-lugar' })
    .returning({ id: systems.id });
  const table = (n: number, placeId: string, startsAt: Date) => ({
    slug: `mesa-lugar-${n}`,
    title: `Mesa ${n}`,
    kind: 'one_shot' as const,
    capacity: 4,
    startsAt,
    durationMinutes: 180,
    timezone: 'America/Sao_Paulo',
    gmId: id(1),
    systemId: system.id,
    publishedAt: approved,
    placeId,
  });
  await test.db.insert(gameTables).values([
    table(1, id(53), new Date('2026-11-01T20:00:00Z')),
    table(2, id(53), new Date('2026-11-02T20:00:00Z')),
    table(3, id(51), new Date('2026-11-03T20:00:00Z')),
    // Over, so not open.
    { ...table(4, id(51), new Date('2026-10-01T20:00:00Z')), status: 'concluded' as const },
  ]);
}, 60_000);

afterAll(async () => {
  await test?.close();
});

describe('the Onde jogar list', () => {
  it('lists only approved places that are up, most open tables first', async () => {
    const page = (await list())!;
    expect(page.places.map((p) => [p.slug, p.openTables])).toEqual([
      ['lugar-3', 2],
      ['lugar-1', 1],
      ['lugar-2', 0],
    ]);
    expect(page.total).toBe(3);
    // Its approved tags, in the order picked; the suggestion waits apart.
    expect(page.places[1].features).toEqual([
      { name: 'Sem taxa para jogar', slug: 'free-to-play' },
      { name: 'Acessível', slug: 'accessible' },
      { name: 'RPG de mesa', slug: 'rpg' },
    ]);
  });

  it('orders by name or newest', async () => {
    expect(await slugs('sort=name')).toEqual(['lugar-3', 'lugar-2', 'lugar-1']);
    expect((await slugs('sort=recent'))[0]).toBe('lugar-2');
  });

  it('filters by search, state, city, kind and tags', async () => {
    expect(await slugs('q=agora')).toEqual(['lugar-2']);
    expect(await slugs('q=boa viagem')).toEqual(['lugar-3', 'lugar-1']);
    expect(await slugs('state=sp')).toEqual(['lugar-2']);
    expect(await slugs('state=pe&city=pe-recife')).toEqual(['lugar-3', 'lugar-1']);
    expect(await slugs('kind=game-cafe')).toEqual(['lugar-1']);
    expect(await slugs('tag=free-to-play&tag=accessible')).toEqual(['lugar-1']);
    expect(await slugs('tag=free-to-play')).toEqual(['lugar-3', 'lugar-1']);
    expect(await slugs('tag=rpg')).toEqual(['lugar-1']);
    // An address from before the catalog still filters.
    expect(await slugs('amenity=free_to_play&amenity=accessible')).toEqual(['lugar-1']);
    expect(await slugs('tag=bar-de-vinil')).toEqual([]);
  });

  it('offers the approved tags some listed place has, and any picked', async () => {
    expect((await list())!.tags.map((tag) => tag.slug)).toEqual([
      'accessible',
      'free-to-play',
      'rpg',
    ]);
    expect((await list('tag=wifi'))!.tags.map((tag) => tag.slug)).toEqual([
      'accessible',
      'free-to-play',
      'wifi',
      'rpg',
    ]);
  });

  it('offers the states with a place, and the cities of the state picked', async () => {
    const all = (await list())!;
    expect(all.states.map((s) => s.slug)).toEqual(['pe', 'sp']);
    expect(all.cities).toEqual([]);
    expect((await list('state=pe'))!.cities).toEqual([{ slug: 'pe-recife', label: 'Recife' }]);
  });

  it('has no page past the last one', async () => {
    expect(await list('page=2')).toBeNull();
    expect((await list('q=nada'))!.places).toEqual([]);
  });
});

describe("a place's page", () => {
  const read = (slug: string, viewer: { id: string; isAdmin: boolean } | null = null) =>
    readPlacePage(test.db, slug, viewer, now);

  it('shows a listed place to anyone, with its links, tags and tables', async () => {
    const page = (await read('lugar-1'))!;
    expect(page.place.name).toBe('Taverna do Dado');
    expect(page.place).not.toHaveProperty('submitterId');
    expect(page.links).toEqual([{ network: 'instagram', url: 'https://instagram.com/taverna' }]);
    expect(page.tags.map((tag) => tag.kind)).toEqual(['state', 'city', 'neighbourhood', 'kind']);
    expect(page.features.map((feature) => feature.slug)).toEqual([
      'free-to-play',
      'accessible',
      'rpg',
    ]);
    expect(page.tables.map((table) => table.slug)).toEqual(['mesa-lugar-3']);
    expect(page).toMatchObject({
      openTables: 1,
      pending: false,
      canEdit: false,
      claimable: true,
      canReport: true,
    });
  });

  it('marks an owned place verified, and lets its owner edit but not report it', async () => {
    const page = (await read('lugar-3', { id: id(2), isAdmin: false }))!;
    expect(page.place.verified).toBe(true);
    expect(page).toMatchObject({ canEdit: true, owner: true, claimable: false, canReport: false });
  });

  it('opens a place waiting for review or hidden only to its submitter and admins', async () => {
    expect(await read('lugar-4')).toBeNull();
    expect(await read('lugar-4', { id: id(3), isAdmin: false })).toBeNull();
    expect(await read('lugar-4', { id: id(1), isAdmin: false })).toMatchObject({
      pending: true,
      canEdit: true,
      canReport: false,
    });
    expect(await read('lugar-5')).toBeNull();
    expect(await read('lugar-5', { id: id(3), isAdmin: true })).toMatchObject({ hidden: true });
  });

  it('shows a suggested tag that waits only to whoever may edit the place, marked', async () => {
    const mine = (await read('lugar-1', { id: id(1), isAdmin: false }))!;
    expect(mine.features.at(-1)).toEqual({
      name: 'Bar de vinil',
      slug: 'bar-de-vinil',
      pending: true,
    });
    const theirs = (await read('lugar-1', { id: id(3), isAdmin: false }))!;
    expect(theirs.features.map((feature) => feature.slug)).not.toContain('bar-de-vinil');
  });

  it('never opens a removed or unknown place', async () => {
    expect(await read('lugar-6', { id: id(3), isAdmin: true })).toBeNull();
    expect(await read('nao-existe')).toBeNull();
  });
});
