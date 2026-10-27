import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { gameTables, places, profiles } from '@mesaaberta/core/server/db/schema';
import type { Actor } from '@mesaaberta/core/server/auth/policy';
import {
  checkTablePlace,
  placeOptions,
  placeSlugOf,
  tablePlace,
  withPlace,
} from '@mesaaberta/core/server/places/picker';
import { findTableBySlug } from '@mesaaberta/core/server/tables/queries';
import { createTable, loadTableForEdit, updateTable } from '@mesaaberta/core/server/tables/write';
import type { TableInput } from '@mesaaberta/core/tables/schema';
import { createTestDb } from '../db/test-db';

let test: Awaited<ReturnType<typeof createTestDb>>;
const now = new Date('2026-10-01T12:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-0000000069${String(n).padStart(2, '0')}`;
const ana: Actor = { id: id(1), role: 'member', status: 'active' };

const input = (over: Partial<TableInput> = {}): TableInput => ({
  systemSlug: 'daggerheart',
  title: 'Mesa no Bar',
  description: 'Uma noite só.',
  extraInfo: null,
  welcomeMessage: null,
  kind: 'one_shot',
  capacity: 5,
  minPlayers: null,
  plannedSessions: null,
  startsAtLocal: '2026-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
  recurrence: null,
  untilLocalDate: null,
  joinMode: 'auto',
  modality: 'in_person',
  locationArea: 'Digitado',
  joinDetails: 'Mesa 3, fundos',
  postalCode: null,
  locationNeighbourhood: null,
  locationCity: null,
  locationState: null,
  placeId: null,
  platforms: [],
  tags: [],
  removeImage: false,
  ...over,
});

type Place = typeof places.$inferInsert;
const place = (n: number, values: Partial<Place> = {}): Place => ({
  id: id(50 + n),
  slug: `lugar-${n}`,
  submitterId: id(1),
  name: `Lugar ${n}`,
  kind: 'bar',
  postalCode: '51020000',
  street: 'Rua 1, 10',
  neighbourhood: 'Boa Viagem',
  city: 'Recife',
  state: 'PE',
  approvedAt: now,
  ...values,
});

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([{ id: id(1), username: 'ana' }]);
  await test.db
    .insert(places)
    .values([
      place(1, { name: 'Bar da Rolagem' }),
      place(2, { name: 'Aguardando', approvedAt: null }),
      place(3, { name: 'Oculto', hiddenAt: now, hiddenReason: 'reports' }),
      place(4, { name: 'Removido', removedAt: now }),
      place(5, { name: 'Arena', neighbourhood: null, city: 'Olinda' }),
    ]);
});
afterAll(() => test.close());

describe('the place picker', () => {
  it('offers only listed places, by name', async () => {
    expect((await placeOptions(test.db)).map((option) => option.name)).toEqual([
      'Arena',
      'Bar da Rolagem',
    ]);
  });

  it("copies a picked place's CEP and area into the table, keeping the private directions", async () => {
    expect(await withPlace(test.db, input(), 'lugar-1')).toMatchObject({
      placeId: id(51),
      postalCode: '51020000',
      locationArea: 'Boa Viagem, Recife - PE',
      locationNeighbourhood: 'Boa Viagem',
      locationCity: 'Recife',
      locationState: 'PE',
      joinDetails: 'Mesa 3, fundos',
    });
  });

  it('refuses a place that is not listed, and ignores one for an online table', async () => {
    for (const slug of ['lugar-2', 'lugar-3', 'lugar-4', 'nenhum'])
      await expect(withPlace(test.db, input(), slug)).rejects.toMatchObject({
        field: 'placeSlug',
        message: 'not_found',
      });
    expect(
      await withPlace(test.db, input({ modality: 'online', locationArea: null }), 'lugar-1'),
    ).toMatchObject({ placeId: null, postalCode: null });
  });

  it('saves the place on the table, shows it on the page and keeps it on edit', async () => {
    const { slug } = await createTable(test.db, ana, await withPlace(test.db, input(), 'lugar-1'), {
      now,
    });
    const table = (await findTableBySlug(test.db, slug, now))!;
    expect(table).toMatchObject({ placeId: id(51), placeName: 'Bar da Rolagem' });
    expect(await tablePlace(test.db, id(51))).toMatchObject({
      name: 'Bar da Rolagem',
      kind: 'bar',
    });
    expect((await loadTableForEdit(test.db, ana, slug, 'America/Sao_Paulo')).placeSlug).toBe(
      'lugar-1',
    );

    // Its place hidden meanwhile, the table still saves with it, and the card stops naming it.
    await test.db
      .update(places)
      .set({ hiddenAt: now, hiddenReason: 'reports' })
      .where(eq(places.id, id(51)));
    await updateTable(test.db, ana, slug, input({ placeId: id(51), title: 'Mesa no Bar 2' }));
    expect((await findTableBySlug(test.db, slug, now))!.placeName).toBeNull();
    expect(await tablePlace(test.db, id(51))).toBeNull();
    await test.db
      .update(places)
      .set({ hiddenAt: null, hiddenReason: null })
      .where(eq(places.id, id(51)));
  });

  it('refuses to point a table at a place that is not listed', async () => {
    await expect(
      createTable(test.db, ana, input({ placeId: id(52) }), { now }),
    ).rejects.toMatchObject({
      field: 'placeSlug',
    });
    await expect(checkTablePlace(test.db, id(53), id(53))).resolves.toBeUndefined();
  });

  it('drops the link when the place is gone, keeping the copied area', async () => {
    const { slug } = await createTable(
      test.db,
      ana,
      await withPlace(test.db, input({ title: 'Outra' }), 'lugar-5'),
      { now },
    );
    await test.db.delete(places).where(eq(places.id, id(55)));
    const [row] = await test.db.select().from(gameTables).where(eq(gameTables.slug, slug));
    expect(row).toMatchObject({ placeId: null, locationArea: 'Olinda - PE' });
    expect(await placeSlugOf(test.db, null)).toBe('');
  });
});
