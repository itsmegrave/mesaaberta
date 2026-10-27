import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gameTables, places, profiles, systems } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { readRoutes } from './reads';

let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = '00000000-0000-4000-8000-000000000f31';
const other = '00000000-0000-4000-8000-000000000f32';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'mestre', role: 'member' },
    { id: other, username: 'outra', role: 'member' },
  ]);
  const [system] = await test.db.select({ id: systems.id }).from(systems).limit(1);
  await test.db.insert(gameTables).values({
    slug: 'mesa-editavel',
    title: 'Mesa editável',
    kind: 'one_shot',
    capacity: 3,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
    gmId: gm,
    systemId: system.id,
  } as never);
  await test.db.insert(places).values({
    slug: 'loja',
    name: 'Loja',
    kind: 'bar',
    submitterId: gm,
    approvedAt: new Date(),
    street: 'Rua A, 1',
    neighbourhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    postalCode: '01001000',
  } as never);
});
afterAll(() => test.close());

const app = () => readRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string, body?: unknown) =>
  app().request(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        [ACTOR_HEADER]: actor,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env,
  );

const input = {
  systemSlug: 'daggerheart',
  title: 'Mesa Nova',
  description: '',
  extraInfo: null,
  welcomeMessage: null,
  kind: 'one_shot',
  capacity: 4,
  minPlayers: null,
  plannedSessions: null,
  startsAtLocal: '2099-10-10T19:00',
  timezone: 'America/Sao_Paulo',
  durationMinutes: 240,
  recurrence: null,
  untilLocalDate: null,
  joinMode: 'auto',
  modality: 'in_person',
  locationArea: null,
  joinDetails: null,
  platforms: [],
  tags: [],
  postalCode: null,
  locationNeighbourhood: null,
  locationCity: null,
  locationState: null,
  placeId: null,
  removeImage: false,
};

describe('api reads for the table forms', () => {
  it('answers a table as its GM edits it, in the zone asked, and 403 to anyone else', async () => {
    const response = await call('/table-edit/mesa-editavel?tz=America/Sao_Paulo', gm);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      slug: 'mesa-editavel',
      title: 'Mesa editável',
      startsAtLocal: '2099-01-01T17:00',
      timezone: 'America/Sao_Paulo',
    });
    expect((await call('/table-edit/mesa-editavel', other)).status).toBe(403);
    expect((await call('/table-edit/nenhuma', gm)).status).toBe(404);
  });

  it('lists the places the picker offers', async () => {
    expect(await (await call('/place-options', gm)).json()).toMatchObject([
      { slug: 'loja', name: 'Loja', city: 'São Paulo' },
    ]);
  });

  it('resolves a picked place into the input, and refuses one that is not listed', async () => {
    const resolved = await (await call('/table-location', gm, { input, placeSlug: 'loja' })).json();
    expect(resolved).toMatchObject({
      postalCode: '01001000',
      locationCity: 'São Paulo',
      locationNeighbourhood: 'Centro',
    });
    expect(resolved.placeId).toEqual(expect.any(String));
    const refused = await call('/table-location', gm, { input, placeSlug: 'nenhum' });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ field: 'placeSlug', message: 'not_found' });
    // No CEP and no place: nothing to look up.
    expect(
      await (
        await call('/table-location', gm, {
          input: { ...input, modality: 'online' },
          placeSlug: '',
        })
      ).json(),
    ).toMatchObject({ modality: 'online', postalCode: null });
  });
});
