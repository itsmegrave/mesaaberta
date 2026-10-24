import { afterAll, beforeAll, expect, it } from 'vitest';
import { profiles, gameTables, systems, registrations } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { invitationRoutes } from './invitations';
import { ACTOR_HEADER } from './admin-guard';
let test: Awaited<ReturnType<typeof createTestDb>>;
const gm = crypto.randomUUID();
const player = crypto.randomUUID();
const other = crypto.randomUUID();
let slug: string;
beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: gm, username: 'inviting-gm' },
    { id: player, username: 'invited-player' },
    { id: other, username: 'other-player' },
  ]);
  const [system] = await test.db.select().from(systems).limit(1);
  slug = 'invitation-api';
  await test.db.insert(gameTables).values({
    slug,
    title: 'Invitation API',
    gmId: gm,
    systemId: system.id,
    kind: 'one_shot',
    capacity: 1,
    startsAt: new Date('2099-01-01T20:00:00Z'),
    durationMinutes: 60,
    timezone: 'UTC',
  });
});
afterAll(() => test.close());
const post = (path: string, actor: string, body: unknown = {}) =>
  invitationRoutes((() => ({ db: test.db, close: async () => {} })) as never).request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', [ACTOR_HEADER]: actor },
      body: JSON.stringify(body),
    },
    { DATABASE_URL: 'postgres://test' },
  );
it('keeps GET and another account from deciding, then converts the reserved last seat', async () => {
  const response = await post(`/tables/${slug}/invitations`, gm, { username: '@invited-player' });
  expect(response.status).toBe(200);
  const { invitationId, eventIds } = (await response.json()) as {
    invitationId: string;
    eventIds: string[];
  };
  expect(eventIds).toHaveLength(1);
  expect((await post(`/invitations/${invitationId}/accept`, other)).status).toBe(404);
  const get = await invitationRoutes((() => ({
    db: test.db,
    close: async () => {},
  })) as never).request(
    `/invitations/${invitationId}/accept`,
    { headers: { [ACTOR_HEADER]: player } },
    { DATABASE_URL: 'postgres://test' },
  );
  expect(get.status).toBe(404);
  expect((await post(`/invitations/${invitationId}/accept`, player)).status).toBe(200);
  expect(await test.db.select().from(registrations)).toMatchObject([
    { playerId: player, status: 'confirmed' },
  ]);
});
it('validates identity and preferences payloads before writing', async () => {
  expect((await post(`/tables/${slug}/invitations`, gm, { username: '' })).status).toBe(400);
  expect((await post('/account/invitation-preferences', player, { enabled: 'false' })).status).toBe(
    400,
  );
});

it('serves authenticated invitation preferences and private lists through the API', async () => {
  const app = invitationRoutes((() => ({ db: test.db, close: async () => {} })) as never);
  const get = (path: string, actor?: string) =>
    app.request(
      path,
      { headers: actor ? { [ACTOR_HEADER]: actor } : {} },
      { DATABASE_URL: 'postgres://test' },
    );
  expect((await get('/account/invitation-preferences')).status).toBe(401);
  const preferences = await get('/account/invitation-preferences', player);
  expect(preferences.status).toBe(200);
  expect(await preferences.json()).toMatchObject({ enabled: true, blocks: [] });
  expect((await get('/account/invitations', player)).status).toBe(200);
  expect((await get(`/tables/${slug}/invitations`, other)).status).toBe(404);
  expect((await get(`/tables/${slug}/invitations`, gm)).status).toBe(200);
  expect((await get(`/tables/${slug}/my-invitation`, player)).status).toBe(200);
});
