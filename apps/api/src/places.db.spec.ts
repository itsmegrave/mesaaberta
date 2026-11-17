import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { places, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { placeRoutes } from './places';

let test: Awaited<ReturnType<typeof createTestDb>>;
const ana = '00000000-0000-4000-8000-000000000c01';
const bia = '00000000-0000-4000-8000-000000000c02';
const placeId = '00000000-0000-4000-8000-000000000c51';
const env = { DATABASE_URL: 'postgres://test' };

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: ana, username: 'ana' },
    { id: bia, username: 'bia' },
  ]);
  await test.db.insert(places).values({
    id: placeId,
    slug: 'bar-da-ana',
    submitterId: ana,
    ownerId: ana,
    ownerSince: new Date(),
    name: 'Bar da Ana',
    kind: 'bar',
    postalCode: '51020000',
    street: 'Rua 1, 10',
    neighbourhood: 'Boa Viagem',
    city: 'Recife',
    state: 'PE',
    approvedAt: new Date(),
  });
});
afterAll(() => test.close());

const app = () => placeRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const call = (path: string, actor: string | null = ana, body?: object) =>
  app().request(
    path,
    {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(actor ? { [ACTOR_HEADER]: actor } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
    env,
  );

describe('api place routes over a database', () => {
  it('answers 404 for a place to edit or claim that is not there', async () => {
    expect((await call('/no-such-place/edit')).status).toBe(404);
    expect((await call('/no-such-place/claim')).status).toBe(404);
  });

  it('refuses a malformed place or claim, and anyone signed out', async () => {
    expect((await call('/', ana, { input: { name: '' } })).status).toBe(400);
    expect((await call('/no-such-place/claim', ana, { relation: 'x' })).status).toBe(400);
    expect((await call('/no-such-place/edit', null)).status).toBe(401);
  });

  it('lets only the owner hand the place back, and records it', async () => {
    expect((await call(`/${placeId}/release`, bia, {})).status).toBe(403);
    const response = await call(`/${placeId}/release`, ana, {});
    expect(response.status).toBe(200);
    expect((await response.json()).eventIds).toHaveLength(1);
    const [row] = await test.db.select().from(places).where(eq(places.id, placeId));
    expect(row.ownerId).toBeNull();
    // Nobody looks after it any more: there is nothing left to hand back.
    expect((await call(`/${placeId}/release`, ana, {})).status).toBe(403);
  });
});
