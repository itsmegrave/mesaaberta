import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { events, profiles } from '@mesaaberta/db/schema';
import { createTestDb } from '../../web/src/lib/server/db/test-db';
import { ACTOR_HEADER } from './admin-guard';
import { announcementRoutes } from './announcements';

let test: Awaited<ReturnType<typeof createTestDb>>;
const admin = '00000000-0000-4000-8000-000000000ba1';
const member = '00000000-0000-4000-8000-000000000ba2';
const env = { DATABASE_URL: 'postgres://test' };
const draft = {
  title: 'Novidade',
  body: '<p>Olá a todos</p>',
  audience: 'all_active_users',
  confirmed: false,
};

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(profiles).values([
    { id: admin, username: 'admin', role: 'admin' },
    { id: member, username: 'member', role: 'member' },
  ]);
});
afterAll(() => test.close());

const app = () => announcementRoutes((() => ({ db: test.db, close: async () => {} })) as never);
const post = (body: unknown, actor?: string) =>
  app().request(
    '/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(actor ? { [ACTOR_HEADER]: actor } : {}) },
      body: JSON.stringify(body),
    },
    env,
  );

describe('api announcement routes over a database', () => {
  it('counts the audience first and sends nothing', async () => {
    const response = await post(draft, admin);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ step: 'confirm', count: 2, recipient: null });
    expect(await test.db.select().from(events)).toHaveLength(0);
  });

  it('records the announcement once confirmed and answers the event to dispatch', async () => {
    const response = await post({ ...draft, confirmed: true }, admin);

    expect(response.status).toBe(200);
    const { step, eventIds } = (await response.json()) as { step: string; eventIds: string[] };
    expect(step).toBe('sent');
    const [event] = await test.db.select().from(events).where(eq(events.id, eventIds[0]));
    expect(event).toMatchObject({ type: 'SystemAnnouncementSent', actorId: admin });
  });

  it('refuses an unknown recipient on the field the form shows', async () => {
    const response = await post(
      { ...draft, audience: 'specific_user', recipient: 'ninguem' },
      admin,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'recipient', message: 'not_found' });
  });

  it('answers 403 to a member, 400 to a bad form and 401 without an actor', async () => {
    expect((await post(draft, member)).status).toBe(403);
    expect((await post({ title: '' }, admin)).status).toBe(400);
    expect((await post(draft)).status).toBe(401);
  });
});
